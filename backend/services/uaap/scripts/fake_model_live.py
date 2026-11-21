"""LOCAL TEST STAND-IN for the model provider (never for production).

Serves the Ollama-compatible endpoints from the UAAP test fake, with a scripted plan for the Finance
Agent: it answers "propose a journal entry" with the lines the user wrote. Used only by the local
end-to-end run to exercise the real approval path without a live model key.

Run: .venv/Scripts/python scripts/fake_model_live.py   (listens on 127.0.0.1:11434)
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import uvicorn

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "src"))

from uaap.gateway.providers.fake_server import FakeOllamaServer  # noqa: E402

PLAN = {
    "intent": "propose_journal_entry",
    "reply": "Proposing the rent accrual.",
    "date": "2026-11-30",
    "currency": "USD",
    "memo": "Rent accrual (local test)",
    "lines": [
        {"account": "6100", "side": "DEBIT", "amount": "1250.00"},
        {"account": "2100", "side": "CREDIT", "amount": "1250.00"},
    ],
}

server = FakeOllamaServer()
for model in server.models:
    server.script(model, [{"content": json.dumps(PLAN)} for _ in range(500)])

if __name__ == "__main__":
    uvicorn.run(server.app, host="127.0.0.1", port=11434, log_level="warning")
