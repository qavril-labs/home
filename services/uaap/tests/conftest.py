"""Pytest fixtures and environment configuration for UAAP tests."""

import sys
from pathlib import Path

# Ensure src is on sys.path
src_dir = Path(__file__).resolve().parent.parent / "src"
if str(src_dir) not in sys.path:
    sys.path.insert(0, str(src_dir))
