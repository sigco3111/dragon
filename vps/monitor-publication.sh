#!/bin/sh
# Read-only local monitor; external notification still requires a receiver.
set -eu
here=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec python3 "$here/monitor-publication.py"
