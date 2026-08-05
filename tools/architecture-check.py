#!/usr/bin/env python3
from pathlib import Path
import re
import sys

root = Path(__file__).resolve().parents[1]
web = root / "src" / "EncounterLab.Web" / "src"
patterns = {
    re.compile(r"Math\.floor\s*\([^)]*(?:damage|amount)[^)]*/\s*2\s*\)", re.IGNORECASE):
        "Resistance arithmetic belongs in the C# domain.",
    re.compile(r"(?:currentHitPoints|temporaryHitPoints)\s*(?:\+\+|--|[+\-*/]?=)"):
        "The client must not mutate authoritative HP values.",
    re.compile(r"\bMath\.random\s*\("):
        "Combat randomness belongs on the server.",
    re.compile(r"\badjustedDamage\s*:"):
        "The client must not submit or construct adjusted damage.",
    re.compile(r"\bdiceResult\s*:"):
        "The client must not submit dice outcomes.",
}

failures = []
for file in web.rglob("*.ts*"):
    if file.name.endswith((".test.ts", ".test.tsx")) or "test" in file.parts:
        continue
    text = file.read_text(encoding="utf-8")
    for pattern, message in patterns.items():
        if pattern.search(text):
            failures.append(f"{file.relative_to(root)}: {message}")

if failures:
    print("Targeted client-authority guardrail failed:")
    print("\n".join(f"- {item}" for item in failures))
    sys.exit(1)

print("Targeted client-authority guardrail passed: no known client-side combat-authority patterns were found.")
