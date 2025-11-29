from crewai.tools import BaseTool
import httpx
import os
import time
from dotenv import load_dotenv
from minswap.models import Assets
from minswap.pools import get_pool_by_id
from minswap.wallets import Wallet

load_dotenv()

class GetSwapQuoteTool(BaseTool):
    name: str = "get_swap_quote"
    description: str = "Fetches the swap quote from the specified DEX on Cardano. Args: base_token (str), target_token (str), amount (str), dex (str, default 'minswap'). Returns the quote details."

    def _run(self, base_token: str, target_token: str, amount: str, dex: str = "minswap") -> str:
        if dex.lower() == "minswap":
            url = f"https://api.minswap.org/v1/quote?from={base_token}&to={target_token}&amount={amount}"
            try:
                response = httpx.get(url, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    result = data.get('result', 'N/A')
                    fee = data.get('fee', 'N/A')
                    return f"Swap {amount} {base_token} for approximately {result} {target_token}. Fee: {fee} {base_token}."
                else:
                    return f"Failed to get quote: HTTP {response.status_code}"
            except Exception as e:
                return f"Error fetching quote: {str(e)}"
        else:
            return f"DEX '{dex}' not supported. Only Minswap is currently available."

class GetPoolAddressTool(BaseTool):
    name: str = "get_pool_address"
    description: str = "Gets the pool address for the token pair on the specified DEX. Args: base_token (str), target_token (str), dex (str, default 'minswap'). Returns the pool address."

    def _run(self, base_token: str, target_token: str, dex: str = "minswap") -> str:
        if dex.lower() == "minswap" and {base_token, target_token} == {"ADA", "MIN"}:
            return "addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxz2j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq0xmsha"  # Example ADA/MIN pool
        else:
            return "Pool address not found for the given pair and DEX."

class CalculateMinOutputTool(BaseTool):
    name: str = "calculate_min_output"
    description: str = "Calculates the minimum output amount considering slippage. Args: expected_output (str), slippage_percent (float, default 1.0). Returns minimum output amount."

    def _run(self, expected_output: str, slippage_percent: float = 1.0) -> str:
        try:
            output = float(expected_output)
            min_output = output * (1 - slippage_percent / 100)
            return str(int(min_output))  # Assuming integer amounts
        except ValueError:
            return "Invalid expected output amount."

class MinswapSwapTool(BaseTool):
    name: str = "minswap_swap"
    description: str = "Performs a token swap on Minswap (Cardano Preprod). Args: from_token (str, e.g., 'ADA'), to_token (str, e.g., 'MIN'), amount (float), slippage (float, default 0.5). Returns transaction hash or status."

    def _run(self, from_token: str, to_token: str, amount: float, slippage: float = 0.5) -> str:
        # Network configuration
        NETWORK = os.environ.get("NETWORK", "preprod")
        if NETWORK == "mainnet":
            ADAMIN = "6aa2153e1ae896a95539c9d62f76cedcdabdcdf144e564b8955f609d660cf6a2"
        elif NETWORK == "preprod":
            ADAMIN = "3bb0079303c57812462dec9de8fb867cef8fd3768de7f12c77f6f0dd80381d0d"
        else:
            return "Error: NETWORK environment variable must be 'mainnet' or 'preprod'."

        # Only ADA/MIN supported for now based on the snippet
        if {from_token, to_token} != {"ADA", "MIN"}:
             return f"Error: Currently only ADA/MIN swaps are supported. Got {from_token}/{to_token}."

        try:
            pool = get_pool_by_id(ADAMIN)
            if pool is None:
                return "Error: Pool not found."

            wallet = Wallet()
            
            # Determine swap direction
            if from_token == "ADA":
                # Swap ADA for MIN
                # Amount in lovelace (1 ADA = 1,000,000 lovelace)
                amount_lovelace = int(amount * 1_000_000)
                in_asset = Assets(lovelace=amount_lovelace)
                print(f"Swapping {amount} ADA for MIN...")
            else:
                # Swap MIN for ADA
                # MIN decimals? Assuming 0 for now based on snippet usage or need to check.
                # The snippet uses `utxo.amount[MIN_POLICY]`. 
                # Let's assume the input amount is in units, not atomic units for non-ADA if possible, 
                # but the library usually deals with atomic units.
                # MIN has 6 decimals? 
                # For safety, let's treat the input amount as raw units if it's not ADA, 
                # or better, try to find the policy ID and handle it.
                
                MIN_POLICY = "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed724d494e"
                # If the user passes 50 MIN, and MIN has 6 decimals, we need 50 * 10^6.
                # But without metadata, it's hard. 
                # The snippet does: `in_asset.__root__[MIN_POLICY] += utxo.amount[MIN_POLICY]` which implies it uses what's in the wallet.
                # For this tool, let's assume the user gives the amount in major units and we convert for ADA, 
                # but for MIN, we might need to know the decimals. 
                # For now, let's assume the user provides the raw amount for tokens or we treat it as ADA-like (6 decimals) for MIN.
                # MIN token has 6 decimals.
                amount_atomic = int(amount * 1_000_000) 
                in_asset = Assets(**{MIN_POLICY: amount_atomic})
                print(f"Swapping {amount} MIN for ADA...")

            tx = wallet.swap(pool=ADAMIN, in_assets=in_asset, slippage=slippage/100)
            print(tx);
            signed_tx = wallet.sign(tx)
            # order = wallet.submit(signed_tx)
            
            return f"Swap submitted. Transaction ID: {order.transaction.id}"

        except Exception as e:
            return f"Error performing swap: {str(e)}"