from crewai.tools import BaseTool
import httpx

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