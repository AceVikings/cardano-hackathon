import os
import logging
from typing import List, Optional
from logging_config import get_logger

try:
    from telegram import Bot
    from telegram.error import TelegramError
except Exception:
    Bot = None
    TelegramError = Exception
import httpx


class TelegramBotAgent:
    """A simple agent that summarizes text and sends it to Telegram chats.

    Summarization uses a lightweight extractive algorithm based on sentence
    scoring by word frequency so the module has no heavy external model
    dependencies.
    """

    def __init__(self, bot_token: Optional[str] = None, chat_ids: Optional[List[str]] = None, logger: Optional[logging.Logger] = None):
        self.logger = logger or get_logger(__name__)
        self.bot_token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN")
        self.chat_ids = chat_ids or self._parse_chat_ids(os.getenv("TELEGRAM_CHAT_IDS", ""))

        if Bot is None:
            self.logger.warning("python-telegram-bot is not installed; Telegram sending will fail until installed.")

        self.bot = Bot(token=self.bot_token) if self.bot_token and Bot is not None else None
        self.logger.info("TelegramBotAgent initialized")

    @staticmethod
    def _parse_chat_ids(raw: str) -> List[str]:
        if not raw:
            return []
        return [c.strip() for c in raw.split(",") if c.strip()]

    def summarize(self, text: str, max_sentences: int = 3) -> str:
        """Create a short extractive summary from `text`.

        This uses sentence tokenization and a simple frequency-based scoring.
        """
        import re

        # Split into sentences (very simple splitter)
        sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', text) if s.strip()]
        if not sentences:
            return ""

        # Build frequency table for words
        from collections import Counter

        words = re.findall(r"\w+", text.lower())
        stopwords = {
            'the', 'and', 'is', 'in', 'to', 'of', 'a', 'for', 'that', 'on', 'with', 'as', 'are', 'it', 'this', 'by'
        }
        freqs = Counter(w for w in words if w not in stopwords)

        # Score sentences
        def score_sentence(sent: str) -> float:
            tokens = re.findall(r"\w+", sent.lower())
            if not tokens:
                return 0.0
            score = sum(freqs.get(t, 0) for t in tokens)
            return score / len(tokens)

        scored = [(score_sentence(s), i, s) for i, s in enumerate(sentences)]
        # Pick top sentences (preserve original order)
        scored.sort(key=lambda x: x[0], reverse=True)
        top = sorted(scored[:max_sentences], key=lambda x: x[1])
        summary = " ".join(s for _, _, s in top)
        self.logger.debug(f"Generated summary (len={len(summary)}): {summary}")
        return summary

    def send_summary(self, summary: str, chat_ids: Optional[List[str]] = None) -> dict:
        """Send `summary` to configured Telegram chat IDs.

        Returns a dict with send results keyed by chat_id.
        """
        results = {}
        chat_list = chat_ids or self.chat_ids

        if not self.bot_token:
            msg = "Telegram bot token not configured"
            self.logger.error(msg)
            raise RuntimeError(msg)

        # Use HTTP API synchronously to avoid async coroutine issues with some PTB versions
        base_url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        for cid in chat_list:
            try:
                resp = httpx.post(base_url, json={"chat_id": cid, "text": summary}, timeout=10.0)
                if resp.status_code == 200:
                    data = resp.json()
                    msg_id = data.get("result", {}).get("message_id")
                    results[cid] = {"ok": True, "message_id": msg_id}
                    self.logger.info("Sent summary to chat %s", cid)
                else:
                    results[cid] = {"ok": False, "status_code": resp.status_code, "text": resp.text}
                    self.logger.error("Failed to send to %s: %s", cid, resp.text)
            except Exception as e:
                self.logger.error("Error sending to %s: %s", cid, str(e))
                results[cid] = {"ok": False, "error": str(e)}

        return results


class CrewShim:
    """Compatibility shim that provides a `crew` object with a `kickoff` method
    so existing callsites (like `main.py`) continue to work.
    """

    class Result:
        def __init__(self, raw: str):
            self.raw = raw

    def __init__(self, agent: TelegramBotAgent):
        self.agent = agent

    def kickoff(self, inputs: dict) -> 'CrewShim.Result':
        text = inputs.get("text") if isinstance(inputs, dict) else None
        if not text:
            raise ValueError("No input text provided to CrewShim.kickoff")

        # Summarize and send
        summary = self.agent.summarize(text)
        send_result = {}
        if self.agent.chat_ids:
            send_result = self.agent.send_summary(summary)

        # Package result: include summary and send metadata
        payload = {
            "summary": summary,
            "sent": send_result
        }
        # Return object with .raw to keep back-compat
        return CrewShim.Result(raw=payload)


class ResearchCrew:
    """Former ResearchCrew name retained for compatibility.

    It now constructs a `TelegramBotAgent` and exposes `crew` with a `kickoff`
    method to match the old API used in `main.py`.
    """

    def __init__(self, verbose: bool = True, logger: Optional[logging.Logger] = None):
        self.logger = logger or get_logger(__name__)
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_ids = TelegramBotAgent._parse_chat_ids(os.getenv("TELEGRAM_CHAT_IDS", ""))
        self.agent = TelegramBotAgent(bot_token=bot_token, chat_ids=chat_ids, logger=self.logger)
        self.crew = CrewShim(self.agent)
        self.logger.info("ResearchCrew (TelegramBotAgent wrapper) initialized")