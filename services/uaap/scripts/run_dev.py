"""Local dev launcher: runs UAAP on 127.0.0.1:8090 with the admin console switched on.

The admin key comes from UAAP_ADMIN_KEY if set; otherwise a random dev key is created once and kept in
services/uaap/.dev-admin-key (git-ignored). Read it from that file; it is never printed.
"""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KEY_FILE = ROOT / ".dev-admin-key"


def _load_dev_env() -> None:
    """Dev only: read KEY=VALUE lines from services/uaap/.dev-env (git-ignored). Real env vars win."""
    path = ROOT / ".dev-env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if "=" in line and not line.lstrip().startswith("#"):
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())


def main() -> None:
    _load_dev_env()
    if not os.environ.get("UAAP_ADMIN_KEY"):
        if not KEY_FILE.exists():
            KEY_FILE.write_text(secrets.token_urlsafe(32), encoding="utf-8")
        os.environ["UAAP_ADMIN_KEY"] = KEY_FILE.read_text(encoding="utf-8").strip()
    os.environ.setdefault("UAAP_ENV", "local")
    sys.path.insert(0, str(ROOT / "src"))

    import uvicorn

    uvicorn.run("uaap.api.main:app", host="127.0.0.1", port=8090, log_level="info")


if __name__ == "__main__":
    main()
