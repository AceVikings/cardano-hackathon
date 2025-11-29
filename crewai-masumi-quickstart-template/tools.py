from crewai import tool
import httpx

@tool
def get_swap_quote(base_token: str, target_token: str, amount: str, dex: str = "minswap") -> str:
    """
    Fetches the swap quote from the specified DEX on Cardano.
    Args:
        base_token: The token to swap from (e.g., 'ADA')
        target_token: The token to swap to (e.g., 'MIN')
        amount: The amount to swap in the smallest unit (e.g., lovelace for ADA)
        dex: The DEX to use (default: minswap)
    Returns:
        A string with the quote details including expected output and fees.
    """
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

@tool
def get_pool_address(base_token: str, target_token: str, dex: str = "minswap") -> str:
    """
    Gets the pool address for the token pair on the specified DEX.
    Args:
        base_token: The base token
        target_token: The target token
        dex: The DEX
    Returns:
        The pool address as a string.
    """
    # Hardcoded for Minswap ADA/MIN pool as example. In reality, this would query an API or database.
    if dex.lower() == "minswap" and {base_token, target_token} == {"ADA", "MIN"}:
        return "addr1z8snz7c4974vzdpxu65ruphl3zjdvtxw8strf2c2tmqnxz2j2c79gy9l76sdg0xwhd7r0c0kna0tycz4y5s6mlenh8pq0xmsha"  # Example ADA/MIN pool
    else:
        return "Pool address not found for the given pair and DEX."

@tool
def calculate_min_output(expected_output: str, slippage_percent: float = 1.0) -> str:
    """
    Calculates the minimum output amount considering slippage.
    Args:
        expected_output: The expected output amount as string
        slippage_percent: Slippage percentage (default 1%)
    Returns:
        Minimum output amount as string.
    """
    try:
        output = float(expected_output)
        min_output = output * (1 - slippage_percent / 100)
        return str(int(min_output))  # Assuming integer amounts
    except ValueError:
        return "Invalid expected output amount."