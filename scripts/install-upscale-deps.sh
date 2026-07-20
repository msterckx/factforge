#!/usr/bin/env bash
# Installs dependencies for scripts/upscale-images.py.
#
# basicsr==1.4.2's sdist on PyPI has a broken setup.py: get_version() does
# `exec(...); return locals()['__version__']`, which reliably KeyErrors on
# Python 3.12+ (locals() inside a function is a snapshot copy there, so the
# exec'd assignment never lands in it). There's no newer basicsr release and
# upstream master has the same bug, so we download the sdist, patch that one
# function to exec into an explicit dict instead, and install the patched
# copy before installing the rest of the requirements.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

BASICSR_VERSION="1.4.2"
TMPDIR="$(mktemp -d)"
trap 'rm -rf "$TMPDIR"' EXIT

echo "Fetching basicsr==${BASICSR_VERSION} sdist..."
URL="$(curl -s "https://pypi.org/pypi/basicsr/${BASICSR_VERSION}/json" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(u['url'] for u in d['urls'] if u['url'].endswith('.tar.gz')))")"
curl -sL -o "$TMPDIR/basicsr.tar.gz" "$URL"

SRC="$TMPDIR/basicsr-${BASICSR_VERSION}"
mkdir -p "$SRC"
tar xzf "$TMPDIR/basicsr.tar.gz" -C "$SRC" --strip-components=1

python3 - "$SRC/setup.py" <<'EOF'
import sys
path = sys.argv[1]
src = open(path).read()
old = """def get_version():
    with open(version_file, 'r') as f:
        exec(compile(f.read(), version_file, 'exec'))
    return locals()['__version__']"""
new = """def get_version():
    ns = {}
    with open(version_file, 'r') as f:
        exec(compile(f.read(), version_file, 'exec'), ns)
    return ns['__version__']"""
if old not in src:
    if "ns = {}" in src:
        print("basicsr setup.py already patched, or already fixed upstream — skipping")
        sys.exit(0)
    sys.exit("basicsr setup.py get_version() didn't match the expected pattern — "
             "upstream may have changed; inspect manually.")
open(path, "w").write(src.replace(old, new))
print("Patched basicsr setup.py")
EOF

echo "Installing patched basicsr..."
pip install --quiet -U pip setuptools wheel
pip install --no-deps --no-build-isolation "$SRC"

echo "Installing remaining requirements..."
pip install -r scripts/requirements-upscale.txt

echo "Done."
