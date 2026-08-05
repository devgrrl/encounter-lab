#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import os
from pathlib import Path
import shutil
import stat
import sys
import tempfile
import zipfile

EXCLUDED_DIRECTORIES = {
    ".git", ".idea", ".vs", ".vscode", ".e2e", "bin", "obj",
    "node_modules", "dist", "coverage", "playwright-report", "test-results",
    "__pycache__",
}
EXCLUDED_SUFFIXES = {".db", ".db-shm", ".db-wal", ".zip", ".tsbuildinfo"}
EXCLUDED_NAMES = {".DS_Store", ".env", "MANIFEST.sha256", "settings.local.json"}


def ignored(_: str, names: list[str]) -> set[str]:
    return {
        name for name in names
        if name in EXCLUDED_DIRECTORIES
        or name in EXCLUDED_NAMES
        or any(name.endswith(suffix) for suffix in EXCLUDED_SUFFIXES)
    }


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_manifest(root: Path) -> None:
    lines = []
    for path in sorted(item for item in root.rglob("*") if item.is_file()):
        relative = path.relative_to(root).as_posix()
        if relative == "MANIFEST.sha256":
            continue
        lines.append(f"{sha256(path)}  {relative}\n")
    (root / "MANIFEST.sha256").write_text("".join(lines), encoding="utf-8", newline="\n")


def write_zip(staged_parent: Path, staged_root: Path, output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in sorted(staged_root.rglob("*")):
            if not path.is_file():
                continue
            archive_name = path.relative_to(staged_parent).as_posix()
            info = zipfile.ZipInfo(archive_name, date_time=(2026, 1, 1, 0, 0, 0))
            mode = stat.S_IMODE(path.stat().st_mode)
            info.external_attr = mode << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: package.py REPOSITORY OUTPUT.zip", file=sys.stderr)
        return 2

    repository = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    lockfile = repository / "src" / "EncounterLab.Web" / "package-lock.json"
    if not lockfile.is_file():
        print("package-lock.json is missing. Run ./tools/setup.sh first.", file=sys.stderr)
        return 1

    with tempfile.TemporaryDirectory(prefix="encounter-lab-package-") as temporary:
        staged_parent = Path(temporary)
        staged_root = staged_parent / repository.name
        shutil.copytree(repository, staged_root, ignore=ignored, copy_function=shutil.copy2)
        write_manifest(staged_root)
        write_zip(staged_parent, staged_root, output)

    print(f"Created {output}")
    print(f"SHA-256 {sha256(output)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
