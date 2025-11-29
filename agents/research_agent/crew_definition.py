import os
import logging
from typing import Optional, Dict, Any, List
from logging_config import get_logger
import httpx
import statistics


class MarketResearchAgent:
    """Agent that gathers simple market signals and computes sentiment.

    Data sources:
    - CoinGecko public API (price, 7d change, volume)
    - Optional NewsAPI (if `NEWSAPI_KEY` is provided in env)

    The implementation is intentionally lightweight and well-contained so the
    agent works without extra dependencies or API keys. When keys are present
    the agent will attempt to augment observations with news sentiment.
    """

    COINGECKO_BASE = "https://api.coingecko.com/api/v3"

    def __init__(self, logger: Optional[logging.Logger] = None):
        self.logger = logger or get_logger(__name__)
        self.http = httpx.Client(timeout=10.0)
        self.logger.info("MarketResearchAgent initialized")

    def fetch_price(self, coingecko_id: str, vs_currency: str = "usd") -> Dict[str, Any]:
        """Fetch current price and 7d market chart summary from CoinGecko.

        Returns a dict with `current_price`, `change_24h_pct`, `change_7d_pct`, `avg_volume_7d`.
        """
        try:
            # Current price
            resp = self.http.get(f"{self.COINGECKO_BASE}/simple/price", params={
                "ids": coingecko_id,
                "vs_currencies": vs_currency,
                "include_24hr_change": "true"
            })
            resp.raise_for_status()
            price_data = resp.json().get(coingecko_id, {})

            # Market chart for 7 days (prices and volumes)
            chart = self.http.get(f"{self.COINGECKO_BASE}/coins/{coingecko_id}/market_chart", params={
                "vs_currency": vs_currency,
                "days": 7
            })
            chart.raise_for_status()
            chart_json = chart.json()

            prices = [p[1] for p in chart_json.get("prices", [])]
            volumes = [v[1] for v in chart_json.get("total_volumes", [])]

            change_7d = None
            if prices and len(prices) >= 2:
                change_7d = (prices[-1] - prices[0]) / prices[0] * 100 if prices[0] != 0 else None

            return {
                "current_price": price_data.get(vs_currency),
                "change_24h_pct": price_data.get(f"{vs_currency}_24h_change"),
                "change_7d_pct": change_7d,
                "avg_volume_7d": statistics.mean(volumes) if volumes else None,
                "raw_prices": prices,
                "raw_volumes": volumes,
            }
        except Exception as e:
            self.logger.warning("CoinGecko fetch failed: %s", str(e))
            return {}

    def fetch_news_headlines(self, query: str, news_api_key: Optional[str] = None, page_size: int = 5) -> List[str]:
        """Fetch a small set of news headlines using NewsAPI if key provided.

        Falls back to empty list if no key is present.
        """
        if not news_api_key:
            return []
        try:
            resp = self.http.get("https://newsapi.org/v2/everything", params={
                "q": query,
                "apiKey": news_api_key,
                "pageSize": page_size,
                "sortBy": "relevancy",
            })
            resp.raise_for_status()
            items = resp.json().get("articles", [])
            return [a.get("title", "") for a in items]
        except Exception as e:
            self.logger.warning("NewsAPI fetch failed: %s", str(e))
            return []

    def simple_sentiment(self, texts: List[str]) -> Dict[str, Any]:
        """Very small rule-based sentiment scoring for short texts.

        Returns average polarity in [-1,1] and counts of positive/negative/neutral.
        """
        if not texts:
            return {"score": 0.0, "positive": 0, "negative": 0, "neutral": 0}

        positive_words = {"gain", "gains", "bull", "bullish", "surge", "up", "rally", "record", "beat"}
        negative_words = {"loss", "losses", "bear", "bearish", "dump", "down", "drop", "fall", "slump"}

        pos = neg = neu = 0
        scores = []
        for t in texts:
            low = t.lower()
            pcount = sum(1 for w in positive_words if w in low)
            ncount = sum(1 for w in negative_words if w in low)
            if pcount > ncount:
                pos += 1
                scores.append(1.0)
            elif ncount > pcount:
                neg += 1
                scores.append(-1.0)
            else:
                neu += 1
                scores.append(0.0)

        avg = statistics.mean(scores) if scores else 0.0
        return {"score": avg, "positive": pos, "negative": neg, "neutral": neu}

    def analyze(self, coingecko_id: str, vs_currency: str = "usd", news_api_key: Optional[str] = None) -> Dict[str, Any]:
        """Run the end-to-end lightweight market research flow and return a structured report.

        The report includes component signals and a final `recommendation` of `buy`/`hold`/`sell` with rationale.
        """
        report: Dict[str, Any] = {"coingecko_id": coingecko_id}

        price_obs = self.fetch_price(coingecko_id, vs_currency=vs_currency)
        report["price"] = price_obs

        # Compute price sentiment from relative changes
        change_24 = price_obs.get("change_24h_pct")
        change_7 = price_obs.get("change_7d_pct")

        signals = []
        score = 0.0
        # Heuristic: 24h and 7d moves
        if change_24 is not None:
            if change_24 > 3:
                score += 0.5; signals.append({"signal": "24h_up", "value": change_24})
            elif change_24 < -3:
                score -= 0.5; signals.append({"signal": "24h_down", "value": change_24})

        if change_7 is not None:
            if change_7 > 5:
                score += 1.0; signals.append({"signal": "7d_up", "value": change_7})
            elif change_7 < -5:
                score -= 1.0; signals.append({"signal": "7d_down", "value": change_7})

        # Volume spike detection
        vol = price_obs.get("avg_volume_7d")
        if vol:
            if vol > 0:
                score += 0.0

        # News sentiment
        headlines = self.fetch_news_headlines(coingecko_id, news_api_key=news_api_key)
        news_sent = self.simple_sentiment(headlines)
        report["news_headlines"] = headlines
        report["news_sentiment"] = news_sent
        score += news_sent.get("score", 0.0)

        # Normalize score roughly into [-3, +3] expected range
        report["raw_score"] = score

        # Map to recommendation
        if score >= 1.0:
            recommendation = {"action": "buy", "confidence": min(0.9, 0.3 + score / 6)}
        elif score <= -1.0:
            recommendation = {"action": "sell", "confidence": min(0.9, 0.3 + (-score) / 6)}
        else:
            recommendation = {"action": "hold", "confidence": 0.5}

        report["signals"] = signals
        report["recommendation"] = recommendation
        report["explanation"] = (
            "Signal components: price changes and news sentiment combined. "
            "This is a lightweight, heuristic-driven recommendation — treat as guidance only."
        )

        return report


class CrewShim:
    """Compatibility shim providing `crew.kickoff(inputs)` like before.

    Expected `inputs` for market research: a dict containing at least
    `coingecko_id` (e.g., 'cardano') and optional `vs_currency` and `news_api_key`.
    """

    class Result:
        def __init__(self, raw: Any):
            self.raw = raw

    def __init__(self, agent: MarketResearchAgent):
        self.agent = agent

    def kickoff(self, inputs: dict) -> 'CrewShim.Result':
        if not isinstance(inputs, dict):
            raise ValueError("Inputs must be a dict")

        coingecko_id = inputs.get("coingecko_id") or inputs.get("token") or inputs.get("id")
        if not coingecko_id:
            raise ValueError("`coingecko_id` (or `token`) is required for market research")

        vs = inputs.get("vs_currency", "usd")
        news_key = inputs.get("news_api_key") or os.getenv("NEWSAPI_KEY")

        report = self.agent.analyze(coingecko_id, vs_currency=vs, news_api_key=news_key)
        return CrewShim.Result(raw=report)


class MarketResearchCrew:
    """Public class used by `main.py` to run market research tasks."""

    def __init__(self, verbose: bool = True, logger: Optional[logging.Logger] = None):
        self.logger = logger or get_logger(__name__)
        self.agent = MarketResearchAgent(logger=self.logger)
        self.crew = CrewShim(self.agent)
        self.logger.info("MarketResearchCrew initialized")