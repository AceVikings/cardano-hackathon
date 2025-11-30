import os
import re
import httpx
from typing import Tuple
from crewai import Agent, Crew, Task
from crewai.tools import tool
from logging_config import get_logger


# ─────────────────────────────────────────────────────────────────────────────
# Helper: parse amount and slippage from user text
# ─────────────────────────────────────────────────────────────────────────────
def parse_amount_and_slippage(text: str) -> Tuple[int, int]:
    """Parse text text to amount (lovelace) and slippage percent."""
    text = text.lower()

    ada_amount = None
    slippage = None

    slip_match = re.search(r"slippage\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*%?", text)
    if not slip_match:
        slip_match = re.search(r"(\d+(?:\.\d+)?)\s*%", text)
    if slip_match:
        try:
            slippage = float(slip_match.group(1))
        except Exception:
            slippage = None

    ada_match = re.search(r"(\d+(?:\.\d+)?)\s*(ada|lovelace)\b", text)
    if ada_match:
        try:
            ada_amount = float(ada_match.group(1))
        except Exception:
            ada_amount = None

    if ada_amount is None:
        num_match = re.search(r"(\d+(?:\.\d+)?)", text)
        if num_match:
            try:
                ada_amount = float(num_match.group(1))
            except Exception:
                ada_amount = None

    if ada_amount is None:
        ada_amount = 5.0

    if slippage is None:
        if "aggressive" in text or "fast" in text or "urgent" in text:
            slippage = 30
        elif "safe" in text or "conservative" in text or "low" in text:
            slippage = 50
        else:
            slippage = 10.0

    slippage_percent = int(round(slippage)) if slippage is not None else 1
    amount_in_lovelace = int(round(ada_amount * 1_000_000))
    print(f"Parsed amount: {amount_in_lovelace} lovelace, slippage: {slippage_percent}%")
    return amount_in_lovelace, slippage_percent


# ─────────────────────────────────────────────────────────────────────────────
# CrewAI Tool: swap ADA -> MIN via minswap service
# ─────────────────────────────────────────────────────────────────────────────
@tool("swap_ada_to_min")
def swap_ada_to_min(text: str, bearer_token: str) -> str:
    """
    Swap ADA to MIN tokens via the Minswap service.

    Args:
        text: A natural language string describing the swap, e.g. "Swap 10 ADA with 2% slippage".
        bearer_token: The authorization bearer token for the swap API.

    Returns:
        A JSON string with the swap result including status, request payload and response.
    """
    import json

    amount_in, slippage = parse_amount_and_slippage(text)

    payload = {
        "assetIn": "lovelace",
        "assetOut": "e16c2dc8ae937e8d3790c7fd7168d7b994621ba14ca11415f39fed72.4d494e",
        "amountIn": str(amount_in),
        "slippagePercent": slippage,
    }

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {bearer_token}",
    }

    swap_url = os.getenv("MIN_SWAP_URL", "http://localhost:5001/api/swap/minswap/swap")

    try:
        resp = httpx.post(swap_url, json=payload, headers=headers, timeout=30.0)
        try:
            resp_json = resp.json()
        except Exception:
            resp_json = {"status_code": resp.status_code, "text": resp.text}

        result = {
            "status": "ok" if resp.status_code < 400 else "error",
            "response": resp_json['unsignedTx'],
        }
    except Exception as e:
        result = {"status": "error", "error": str(e)}

    return json.dumps(result, indent=2)


# ─────────────────────────────────────────────────────────────────────────────
# Crew definition
# ─────────────────────────────────────────────────────────────────────────────
class ResearchCrew:
    def __init__(self, verbose=True, logger=None):
        self.verbose = verbose
        self.logger = logger or get_logger(__name__)
        self.crew = self.create_crew()
        self.logger.info("ResearchCrew initialized")

    def create_crew(self):
        self.logger.info("Creating swap agent crew")

        swap_agent = Agent(
            role="Swap Executor",
            goal="Extract token amount and slippage from user input and execute the swap",
            backstory=(
                "You are a DeFi assistant specialized in Cardano token swaps. "
                "You parse user instructions to determine the ADA amount and slippage, "
                "then call the swap_ada_to_min tool to perform the swap."
            ),
            tools=[swap_ada_to_min],
            verbose=self.verbose,
        )

        self.logger.info("Created swap agent with swap_ada_to_min tool")

        crew = Crew(
            agents=[swap_agent],
            tasks=[
                Task(
                    description=(
                        "The user wants to swap ADA for MIN tokens.\n\n"
                        "User text (contains ADA amount and slippage): {text}\n\n"
                        "Bearer token for authentication: {bearer_token}\n\n"
                        "Extract the ADA amount and slippage percentage from the text, "
                        "then call the swap_ada_to_min tool with the text string and the bearer_token provided above."
                    ),
                    expected_output="The JSON result from the swap tool containing the unsigned transaction hash or error details.",
                    agent=swap_agent,
                )
            ],
        )
        self.logger.info("Crew setup completed")
        return crew