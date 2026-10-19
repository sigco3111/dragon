#!/bin/sh
# Read-only local monitor. Journal failures still need an external alert receiver.
set -eu
container=dragon-editor-publication-editor-1
state=$(docker inspect "$container" --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}')
last=$(docker logs --tail 100 "$container" 2>&1 | grep '"event":' | tail -n 1 || true)
case "$last" in
    *'"distribution-blocked"'*|*'"distribution-faulted"'*|*'"startup-failed"'*|*'"shutdown-failed"'*)
        echo 'editor distribution/lifecycle alarm; operator audit required' >&2; exit 1 ;;
esac
case "$state" in
    'running starting') echo 'editor preflight still running'; exit 0 ;;
    'running healthy') ;;
    *) echo 'editor process/liveness alarm' >&2; exit 1 ;;
esac
curl -fsS --max-time 5 -H 'Host: dragon-editor.720108.xyz' http://127.0.0.1:8788/api/health > /dev/null
# Never claim current-root admission, publication readiness or backup freshness.
echo 'editor local liveness/last reported distribution state OK'
