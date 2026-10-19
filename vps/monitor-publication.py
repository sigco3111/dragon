#!/usr/bin/env python3
"""Read-only local monitor. Exit nonzero on faults or uncertain observations.

This is liveness/distribution monitoring, NOT publication admission or a backup
freshness guarantee. No restart, SQL mutation, unlock, or secret output occurs.
"""
import datetime as dt
import json
import subprocess
import sys
import urllib.request

CONTAINER = "dragon-editor-publication-editor-1"
STARTUP_SECONDS = 1800  # Same bound as compose healthcheck.start_period.
LOG_LINES = 10000
MAX_BYTES = 1024 * 1024
FAULTS = frozenset({"distribution-blocked", "distribution-faulted", "startup-failed", "shutdown-failed"})
EVENTS = FAULTS | {"started", "stopped", "distribution-pending", "distribution-idle", "distribution-confirmed"}


def instant(value):
    if not isinstance(value, str):
        raise ValueError("timestamp required")
    parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError("timezone required")
    return parsed.astimezone(dt.timezone.utc)


def unique_fields(pairs):
    value = {}
    for key, item in pairs:
        if key in value:
            raise ValueError("duplicate JSON field")
        value[key] = item
    return value


def evaluate(state, logs, now):
    """Returns a sanitized observation; logs MUST be scoped to StartedAt."""
    if not isinstance(state, dict) or state.get("Status") != "running" or state.get("OOMKilled") is not False:
        return "container-not-running"
    try:
        age = (now - instant(state["StartedAt"])).total_seconds()
    except (KeyError, TypeError, ValueError, OverflowError):
        return "container-start-unknown"
    if age < -5:
        return "container-clock-invalid"
    if not isinstance(logs, str) or len(logs.encode("utf-8")) > MAX_BYTES or len(logs.splitlines()) >= LOG_LINES:
        return "logs-incomplete"
    events = []
    for line in logs.splitlines():
        try:
            row = json.loads(line, object_pairs_hook=unique_fields)
        except (ValueError, TypeError):
            if '"event"' in line:
                return "event-malformed"
            continue  # Node diagnostics are not application event records.
        if not isinstance(row, dict) or "event" not in row:
            continue
        if set(row) != {"event"} or not isinstance(row["event"], str) or row["event"] not in EVENTS:
            return "event-unknown"
        events.append(row["event"])
    # A later stopped/idle/confirmed event must NEVER hide a fault in this run.
    for event in events:
        if event in FAULTS:
            return event
    if "stopped" in events:
        return "process-stopped"
    health = state.get("Health")
    status = health.get("Status") if isinstance(health, dict) else None
    if status == "starting":
        return "preflight" if age < STARTUP_SECONDS else "preflight-timeout"
    if status != "healthy":
        return "container-unhealthy"
    if "started" not in events:
        return "startup-event-missing"
    return "probe-health"


def command(arguments):
    result = subprocess.run(arguments, capture_output=True, timeout=20, check=False)
    if result.returncode != 0 or len(result.stdout) + len(result.stderr) > MAX_BYTES:
        raise ValueError("command failed or exceeded observation budget")
    return result.stdout.decode("utf-8", errors="strict"), result.stderr.decode("utf-8", errors="strict")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def health_probe():
    request = urllib.request.Request("http://127.0.0.1:8788/api/health", headers={"Host": "dragon-editor.720108.xyz"})
    # Never use proxy environment variables or follow a redirect off loopback.
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    with opener.open(request, timeout=5) as response:
        body = response.read(4097)
        if response.status != 200 or len(body) > 4096 or response.headers.get_content_type() != "application/json":
            return False
    try:
        value = json.loads(body)
    except (ValueError, UnicodeDecodeError):
        return False
    return (isinstance(value, dict) and value.get("service") == "dragon-editor"
            and value.get("stage") == "accounts-sessions" and type(value.get("initialized")) is bool)


def run(read_command=command, probe=health_probe, now=None):
    try:
        output, _ = read_command(["docker", "inspect", "--format", "{{json .State}}", CONTAINER])
        state = json.loads(output)
        # Validate before passing an argument from Docker to another Docker call.
        if not isinstance(state, dict):
            raise ValueError("state")
        started = state.get("StartedAt")
        instant(started)
        stdout, stderr = read_command(["docker", "logs", "--since", started, "--tail", str(LOG_LINES), CONTAINER])
        # Docker separates stdout/stderr; preserve both. Events on either count.
        observation = evaluate(state, stdout + "\n" + stderr, now or dt.datetime.now(dt.timezone.utc))
        if observation == "probe-health":
            observation = "healthy" if probe() else "health-invalid"
    except Exception:
        # Do not print raw subprocess/HTTP exceptions: they can contain payloads.
        observation = "observation-failed"
    ok = observation in {"healthy", "preflight"}
    return (0 if ok else 1), "editor monitor: " + observation


if __name__ == "__main__":
    code, message = run()
    print(message, file=sys.stdout if code == 0 else sys.stderr)
    sys.exit(code)
