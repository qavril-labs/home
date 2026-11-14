"""Shared guardrails. Every agent built on `BaseAgent` runs these; agents cannot opt out.

The rule behind all of them: an agent may only state a figure, date or identifier that it can
point to a source for. Sources are the user's own message, the outputs of tools that actually ran,
values the agent's code generated (such as a document reference) and the business date.
Anything else is treated as a possible hallucination and is not shown to the user.
"""

from __future__ import annotations

import json
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from enum import StrEnum
from typing import Any


class Guardrail(StrEnum):
    """Canonical guardrail codes. Every agent card must declare all of MANDATORY_GUARDRAILS."""

    INPUT_LIMITS = "INPUT_LIMITS"  # Empty or oversized input is refused before any model call.
    PII_REDACTION = "PII_REDACTION"  # Card numbers and national ids are masked before the model sees them.
    INJECTION_DETECTION = "INJECTION_DETECTION"  # Instruction-override phrases are flagged and recorded.
    DATA_DELIMITING = "DATA_DELIMITING"  # User text reaches the model wrapped as data, not instructions.
    SCHEMA_OUTPUT = "SCHEMA_OUTPUT"  # Model output must match a JSON schema or the request fails.
    GROUNDED_FIGURES = "GROUNDED_FIGURES"  # Figures, dates and ids must come from a source.
    GROUNDED_REPLY = "GROUNDED_REPLY"  # The final reply text is checked against sources before it is shown.
    NO_MODEL_ARITHMETIC = "NO_MODEL_ARITHMETIC"  # The model never computes amounts; products do.
    SCOPE_LIMIT = "SCOPE_LIMIT"  # Requests outside the card's use cases are refused.
    TIERED_TOOLS = "TIERED_TOOLS"  # Every product action goes through the tier engine.
    HUMAN_APPROVAL = "HUMAN_APPROVAL"  # Binding actions wait for a different person to approve.
    NO_FABRICATED_FALLBACK = "NO_FABRICATED_FALLBACK"  # Failures are reported, never replaced with output.


MANDATORY_GUARDRAILS: frozenset[Guardrail] = frozenset(Guardrail)


class GuardrailEvent(StrEnum):
    """What a guardrail recorded during one request. Reported in replies, metrics and audit."""

    INPUT_EMPTY = "INPUT_EMPTY"
    INPUT_TOO_LONG = "INPUT_TOO_LONG"
    PII_REDACTED = "PII_REDACTED"
    INJECTION_SUSPECTED = "INJECTION_SUSPECTED"
    UNGROUNDED_FIGURE = "UNGROUNDED_FIGURE"
    UNGROUNDED_IDENTIFIER = "UNGROUNDED_IDENTIFIER"
    UNGROUNDED_REPLY = "UNGROUNDED_REPLY"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


# Figures are standalone numbers. Digits that are part of a word, code, date or id are not figures:
# "UFA-3F2A", "2026-11-30" and UUID segments are handled by the date and id patterns instead.
_FIGURE = re.compile(r"(?<![\w.\-/:])\d[\d,]*(?:\.\d+)?(?![\w\-/:])")
_DATE = re.compile(r"(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)")
_UUID = re.compile(r"\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b")

# Separators inside the number are allowed; digits glued to words or ids (UUID segments) are not cards.
_CARD = re.compile(r"(?<![\w-])(?:\d[ -]?){12,18}\d(?![\w-])")
_NATIONAL_IDS: tuple[re.Pattern[str], ...] = (
    re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)"),  # US SSN
    re.compile(r"(?<!\d)\d{4} \d{4} \d{4}(?!\d)"),  # India Aadhaar
    re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b"),  # India PAN
)
_INJECTION = re.compile(
    r"(?i)\b(ignore (all |any |the )?(previous|prior|above) (instructions|rules)|disregard (the|your) "
    r"(rules|instructions)|you are now|system prompt|developer mode|act as (an? )?(admin|administrator|root)|"
    r"jailbreak|override (the )?(policy|rules|guardrails))\b"
)


def _luhn_ok(digits: str) -> bool:
    total = 0
    for i, ch in enumerate(reversed(digits)):
        n = int(ch)
        if i % 2 == 1:
            n *= 2
            if n > 9:
                n -= 9
        total += n
    return total % 10 == 0


def redact_pii(text: str) -> tuple[str, bool]:
    """Mask payment card numbers (Luhn-valid) and national ids. Returns (text, changed)."""
    changed = False

    def card(match: re.Match[str]) -> str:
        nonlocal changed
        digits = re.sub(r"\D", "", match.group(0))
        if 13 <= len(digits) <= 19 and _luhn_ok(digits):
            changed = True
            return "[REDACTED-CARD]"
        return match.group(0)

    text = _CARD.sub(card, text)
    for pattern in _NATIONAL_IDS:
        text, count = pattern.subn("[REDACTED-ID]", text)
        changed = changed or count > 0
    return text, changed


def looks_like_injection(text: str) -> bool:
    return _INJECTION.search(text) is not None


def figures_in(text: str) -> set[Decimal]:
    values: set[Decimal] = set()
    for token in _FIGURE.findall(text):
        try:
            values.add(Decimal(token.replace(",", "")))
        except InvalidOperation:
            continue
    return values


def dates_in(text: str) -> set[str]:
    return set(_DATE.findall(text))


def ids_in(text: str) -> set[str]:
    return {m.lower() for m in _UUID.findall(text)}


def mentions(text: str, value: str, *, ignore_case: bool = False) -> bool:
    """True when `value` appears in `text` as a whole token."""
    flags = re.IGNORECASE if ignore_case else 0
    return re.search(rf"(?<![\w.-]){re.escape(value)}(?![\w-])", text, flags) is not None


@dataclass
class Sources:
    """Everything an agent may quote in one request."""

    texts: list[str] = field(default_factory=list)

    def add(self, value: Any) -> None:
        if value is None:
            return
        self.texts.append(value if isinstance(value, str) else json.dumps(value, sort_keys=True, default=str))

    @property
    def _joined(self) -> str:
        return "\n".join(self.texts)

    def figures(self) -> set[Decimal]:
        return figures_in(self._joined)

    def dates(self) -> set[str]:
        return dates_in(self._joined)

    def ids(self) -> set[str]:
        return ids_in(self._joined)


@dataclass(frozen=True)
class GroundingResult:
    ok: bool
    missing_figures: tuple[str, ...] = ()
    missing_dates: tuple[str, ...] = ()
    missing_ids: tuple[str, ...] = ()


def check_grounded(text: str, sources: Sources) -> GroundingResult:
    """Every figure, date and UUID in `text` must appear somewhere in `sources`."""
    known_figures = sources.figures()
    missing_figures = sorted(str(f) for f in figures_in(text) if f not in known_figures)
    missing_dates = sorted(dates_in(text) - sources.dates())
    missing_ids = sorted(ids_in(text) - sources.ids())
    return GroundingResult(
        ok=not (missing_figures or missing_dates or missing_ids),
        missing_figures=tuple(missing_figures),
        missing_dates=tuple(missing_dates),
        missing_ids=tuple(missing_ids),
    )


def all_figures_grounded(values: Iterable[str], sources: Sources) -> bool:
    known = sources.figures()
    for value in values:
        try:
            if Decimal(value.replace(",", "")) not in known:
                return False
        except InvalidOperation:
            return False
    return True
