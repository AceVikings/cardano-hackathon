import os
from typing import ClassVar, List, Union
from dotenv import load_dotenv
from crewai.tools import BaseTool
import httpx

# Charli3 Dendrite & PyCardano imports
from charli3_dendrite.dexs.amm.minswap import MinswapCPPState, MinswapOrderDatum
from charli3_dendrite.dataclasses.models import PoolSelector
from charli3_dendrite.utility import Assets
from pycardano import (
    Address,
    BlockFrostChainContext,
    ExtendedSigningKey,
    HDWallet,
    Network,
    PaymentSigningKey,
    PaymentVerificationKey,
    TransactionBuilder,
    TransactionOutput,
    Value,
    PlutusV1Script,
    plutus_script_hash,
    MultiAsset,
    Asset,
    AssetName,
    ScriptHash
)
from blockfrost import ApiUrls

load_dotenv()

# Preprod Minswap Configuration
MINSWAP_PREPROD_SCRIPT_HASH = "c3e28c36c3447315ba5a56f33da6a6ddc1770a876a8d9f0cb3a97c4c"

class PreprodMinswapCPPState(MinswapCPPState):
    """Minswap Constant Product Pool State for Preprod."""
    
    _stake_address: ClassVar[List[Address]] = [] # No stake address for now or use dummy if needed

    @classmethod
    def pool_selector(cls) -> PoolSelector:
        # This might need adjustment if we want to find specific pools on Preprod
        # For now, we rely on the user providing token names or we search by asset
        return PoolSelector(addresses=[], assets=[])

    @classmethod
    def order_address(cls) -> Address:
        # Derive address from script hash
        script_hash = plutus_script_hash(PlutusV1Script(bytes.fromhex(MINSWAP_PREPROD_SCRIPT_HASH)))
        return Address(payment_part=script_hash, network=Network.TESTNET)

class GetSwapQuoteTool(BaseTool):
    name: str = "get_swap_quote"
    description: str = "Fetches the swap quote from the specified DEX on Cardano. Args: base_token (str), target_token (str), amount (str), dex (str, default 'minswap'). Returns the quote details."

    def _run(self, base_token: str, target_token: str, amount: str, dex: str = "minswap") -> str:
        if dex.lower() == "minswap":
            # Using Minswap API for quotes is still valid and easier than querying contract state for just a quote
            # But we should use the Preprod API if available. 
            # Minswap Mainnet API: https://api.minswap.org/v1/quote
            # Minswap Preprod API: https://api-preprod.minswap.org/v1/quote (Assuming standard pattern, verify if fails)
            
            network = os.environ.get("NETWORK", "preprod").lower()
            base_url = "https://api-preprod.minswap.org/v1" if network == "preprod" else "https://api.minswap.org/v1"
            
            url = f"{base_url}/quote?from={base_token}&to={target_token}&amount={amount}"
            try:
                response = httpx.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    result = data.get('result', 'N/A')
                    fee = data.get('fee', 'N/A')
                    return f"Swap {amount} {base_token} for approximately {result} {target_token}. Fee: {fee} {base_token}."
                else:
                    return f"Failed to get quote: HTTP {response.status_code} - {response.text}"
            except Exception as e:
                return f"Error fetching quote: {str(e)}"
        else:
            return f"DEX '{dex}' not supported. Only Minswap is currently available."

class GetPoolAddressTool(BaseTool):
    name: str = "get_pool_address"
    description: str = "Gets the pool address for the token pair on the specified DEX. Args: base_token (str), target_token (str), dex (str, default 'minswap'). Returns the pool address."

    def _run(self, base_token: str, target_token: str, dex: str = "minswap") -> str:
        return "Pool address lookup not fully implemented for dynamic pairs yet."

class CalculateMinOutputTool(BaseTool):
    name: str = "calculate_min_output"
    description: str = "Calculates the minimum output amount considering slippage. Args: expected_output (str), slippage_percent (float, default 1.0). Returns minimum output amount."

    def _run(self, expected_output: str, slippage_percent: float = 1.0) -> str:
        try:
            output = float(expected_output)
            min_output = output * (1 - slippage_percent / 100)
            return str(int(min_output))
        except ValueError:
            return "Invalid expected output amount."

class MinswapSwapTool(BaseTool):
    name: str = "minswap_swap"
    description: str = "Performs a token swap on Minswap (Cardano Preprod). Args: from_token (str, e.g., 'ADA'), to_token (str, e.g., 'MIN'), amount (float), slippage (float, default 0.5). Returns transaction hash or status."

    def _run(self, from_token: str, to_token: str, amount: float, slippage: float = 0.5) -> str:
        # 1. Configuration
        project_id = os.environ.get("BLOCKFROST_PROJECT_ID")
        mnemonic = os.environ.get("MNEMONIC")
        print(mnemonic)
        network_env = os.environ.get("NETWORK", "preprod").lower()

        if not project_id or not mnemonic:
            return "Error: BLOCKFROST_PROJECT_ID and MNEMONIC environment variables are required."

        if network_env != "preprod":
            return "Error: This tool is currently configured for Preprod only."

        try:
            # 2. Setup Context and Wallet
            context = BlockFrostChainContext(
                project_id=project_id,
                base_url=ApiUrls.preprod.value
            )
            
            # Load wallet
            print("Loading wallet...")
            
            hd_wallet = HDWallet.from_mnemonic(mnemonic)
            hd_wallet_spend = hd_wallet.derive_from_path("m/1852'/1815'/0'/0/0")
            esk = ExtendedSigningKey.from_primitive(hd_wallet_spend.xprivate_key)
            print(esk)
            payment_skey = esk.signing_key
            payment_vkey = esk.verification_key
            
            address = Address(payment_part=payment_vkey.hash(), network=Network.TESTNET)
            
            # 3. Prepare Assets
            # Convert amount to atomic units
            # ADA = 6 decimals
            
            MIN_POLICY_ID = "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e" # Example
            MIN_ASSET_NAME = "4d494e" # "MIN" in hex
            
            if from_token == "ADA":
                amount_atomic = int(amount * 1_000_000)
                in_assets = Assets(lovelace=amount_atomic)
                # Out asset is MIN
                out_assets = Assets(**{f"{MIN_POLICY_ID}{MIN_ASSET_NAME}": 0}) 
            elif from_token == "MIN":
                amount_atomic = int(amount * 1_000_000) # Assuming 6 decimals for MIN
                in_assets = Assets(**{f"{MIN_POLICY_ID}{MIN_ASSET_NAME}": amount_atomic})
                out_assets = Assets(lovelace=0)
            else:
                return f"Error: Unsupported token {from_token}. Only ADA and MIN are supported in this demo."

            # 4. Create Order Datum
            # Derive Preprod Order Address
            order_script_hash = "c3e28c36c3447315ba5a56f33da6a6ddc1770a876a8d9f0cb3a97c4c"
            order_address = Address(
                payment_part=bytes.fromhex(order_script_hash), 
                network=Network.TESTNET
            )

            # Batcher fee and deposit
            batcher_fee = Assets(lovelace=2_000_000) # 2 ADA
            deposit = Assets(lovelace=2_000_000) # 2 ADA
            
            datum = MinswapOrderDatum.create_datum(
                address_source=address,
                in_assets=in_assets,
                out_assets=out_assets,
                batcher_fee=batcher_fee,
                deposit=deposit,
                address_target=address # Send back to same address
            )

            # 5. Build Transaction
            builder = TransactionBuilder(context)
            builder.add_input_address(address)
            
            # Add output to order address with datum
            # Amount sent to order address = in_assets + batcher_fee + deposit
            total_value = Value(coin=batcher_fee.lovelace + deposit.lovelace)
            
            if "lovelace" in in_assets:
                total_value.coin += in_assets["lovelace"]
            
            # Handle non-ADA assets in in_assets
            multi_asset = MultiAsset()
            has_tokens = False
            
            for policy, asset_dict in in_assets.items():
                if policy != "lovelace":
                    # policy is hex string
                    policy_id = ScriptHash(bytes.fromhex(policy))
                    asset_map = Asset()
                    for asset_name_hex, quantity in asset_dict.items():
                        asset_name = AssetName(bytes.fromhex(asset_name_hex))
                        asset_map[asset_name] = quantity
                    multi_asset[policy_id] = asset_map
                    has_tokens = True
            
            if has_tokens:
                total_value.multi_asset = multi_asset

            builder.add_output(
                TransactionOutput(
                    address=order_address,
                    amount=total_value,
                    datum=datum
                )
            )
            
            # 6. Sign and Submit
            signed_tx = builder.build_and_sign([payment_skey], change_address=address)
            context.submit_tx(signed_tx)
            
            return f"Swap transaction submitted. Tx ID: {signed_tx.id}"

        except Exception as e:
            print(e);
            return f"Error performing swap: {str(e)}"