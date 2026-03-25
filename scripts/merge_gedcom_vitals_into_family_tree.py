#!/usr/bin/env python3
"""Backward-compatible entry point — calls sync_family_tree_json.py."""

from __future__ import annotations

import importlib.util
from pathlib import Path

_here = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("_sync_ft", _here / "sync_family_tree_json.py")
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)
raise SystemExit(_mod.main())
