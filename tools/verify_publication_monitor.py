#!/usr/bin/env python3
"""Pure fake-port monitor regression; never contacts Docker, SQLite or SAVE.DAT."""
import copy
import datetime as dt
import importlib.util
import json
import unittest
from email.message import Message
from pathlib import Path
from unittest.mock import MagicMock, patch

spec = importlib.util.spec_from_file_location("publication_monitor", Path(__file__).resolve().parents[1] / "vps/monitor-publication.py")
if spec is None or spec.loader is None:
    raise RuntimeError("monitor module unavailable")
monitor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(monitor)
NOW = dt.datetime(2026, 10, 19, 16, 0, tzinfo=dt.timezone.utc)
STATE = {"Status": "running", "OOMKilled": False, "StartedAt": "2026-10-19T15:59:00.123456789Z", "Health": {"Status": "healthy"}}
STARTED = '{"event":"started"}\n{"event":"distribution-idle"}'


class MonitorTests(unittest.TestCase):
    def evaluate(self, state=None, logs: object = STARTED):
        return monitor.evaluate(copy.deepcopy(STATE if state is None else state), logs, NOW)

    def test_healthy(self):
        self.assertEqual(self.evaluate(), "probe-health")

    def test_fault_cannot_be_hidden_by_later_events(self):
        for event in monitor.FAULTS:
            with self.subTest(event=event):
                self.assertEqual(self.evaluate(logs=STARTED + '\n' + json.dumps({"event": event}) + '\n{"event":"stopped"}\n{"event":"distribution-confirmed"}'), event)

    def test_preflight_is_bounded(self):
        state = copy.deepcopy(STATE)
        state["Health"]["Status"] = "starting"
        self.assertEqual(self.evaluate(state, ""), "preflight")
        state["StartedAt"] = "2026-10-19T15:30:00Z"
        self.assertEqual(self.evaluate(state, ""), "preflight-timeout")
        state["StartedAt"] = "2026-10-19T15:30:00.001Z"
        self.assertEqual(self.evaluate(state, ""), "preflight")
        self.assertEqual(self.evaluate(state, '{"event":"startup-failed"}'), "startup-failed")

    def test_failed_and_unknown_container_states(self):
        for state_patch, expected in [({"Status": "exited"}, "container-not-running"), ({"OOMKilled": True}, "container-not-running"), ({"Health": None}, "container-unhealthy"), ({"Health": {"Status": "unhealthy"}}, "container-unhealthy"), ({"StartedAt": None}, "container-start-unknown"), ({"StartedAt": "not a date"}, "container-start-unknown"), ({"StartedAt": "2026-10-19T15:59:00"}, "container-start-unknown"), ({"StartedAt": "2026-10-19T16:00:06Z"}, "container-clock-invalid")]:
            with self.subTest(state_patch=state_patch):
                self.assertEqual(self.evaluate(STATE | state_patch), expected)

    def test_observation_limits_fail_closed(self):
        self.assertEqual(self.evaluate(logs="x" * (monitor.MAX_BYTES + 1)), "logs-incomplete")
        self.assertEqual(self.evaluate(logs="\n" * monitor.LOG_LINES), "logs-incomplete")
        self.assertEqual(self.evaluate(logs=None), "logs-incomplete")

    def test_unknown_event_does_not_silently_pass(self):
        for row in [{"event": "future-event"}, {"event": []}, {"event": "started", "extra": "not logged"}]:
            self.assertEqual(self.evaluate(logs=json.dumps(row)), "event-unknown")
        self.assertEqual(self.evaluate(logs="(node:1) SQLite warning\n" + STARTED), "probe-health")
        self.assertEqual(self.evaluate(logs='{"other":"harmless"}'), "startup-event-missing")
        self.assertEqual(self.evaluate(logs=STARTED + '\n{"event":"stopped"}'), "process-stopped")

    def test_corrupt_event_is_not_ignored_as_a_warning(self):
        for row in ['{"event":"distribution-faulted"', '{"event":"distribution-faulted","event":"distribution-idle"}']:
            self.assertEqual(self.evaluate(logs=STARTED + "\n" + row), "event-malformed")

    def ports(self, state=STATE, stdout=STARTED, stderr="", probe=lambda: True):
        calls = []
        def command(args):
            calls.append(args)
            return (json.dumps(state), "") if args[1] == "inspect" else (stdout, stderr)
        return monitor.run(read_command=command, probe=probe, now=NOW), calls

    def test_exact_readonly_commands_scoped_to_current_run(self):
        result, calls = self.ports()
        self.assertEqual(result, (0, "editor monitor: healthy"))
        self.assertEqual(calls, [["docker", "inspect", "--format", "{{json .State}}", monitor.CONTAINER], ["docker", "logs", "--since", STATE["StartedAt"], "--tail", str(monitor.LOG_LINES), monitor.CONTAINER]])

    def test_fault_on_stderr_and_failed_probe(self):
        result, _ = self.ports(stderr='{"event":"distribution-blocked"}')
        self.assertEqual(result, (1, "editor monitor: distribution-blocked"))
        result, _ = self.ports(probe=lambda: False)
        self.assertEqual(result, (1, "editor monitor: health-invalid"))

    def test_preflight_never_probes_health(self):
        def forbidden():
            self.fail("preflight must not probe")
        state = STATE | {"Health": {"Status": "starting"}}
        result, _ = self.ports(state=state, stdout="", probe=forbidden)
        self.assertEqual(result, (0, "editor monitor: preflight"))

    def test_health_probe_body_and_redirect_policy(self):
        for body, status, mime, expected in [
            (b'{"service":"dragon-editor","stage":"accounts-sessions","initialized":true}', 200, "application/json", True),
            (b'{"service":"dragon-editor","stage":"accounts-sessions","initialized":false}', 200, "application/json", True),
            (b'{}', 200, "application/json", False),
            (b'not-json', 200, "application/json", False),
            (b'[]', 200, "application/json", False),
            (b'x' * 4097, 200, "application/json", False),
            (b'{}', 503, "application/json", False),
            (b'{}', 200, "text/html", False),
            (b'{"service":"dragon-editor","stage":"accounts-sessions","initialized":1}', 200, "application/json", False),
        ]:
            with self.subTest(status=status, mime=mime, size=len(body)):
                response = MagicMock()
                response.status = status
                response.read.return_value = body
                response.headers = Message()
                response.headers["Content-Type"] = mime
                opener = MagicMock()
                opener.open.return_value.__enter__.return_value = response
                with patch.object(monitor.urllib.request, "build_opener", return_value=opener) as build:
                    self.assertEqual(monitor.health_probe(), expected)
                    handlers = build.call_args.args
                    self.assertEqual(handlers[0].proxies, {})
                    self.assertIsInstance(handlers[1], monitor.NoRedirect)
                    request = opener.open.call_args.args[0]
                    self.assertEqual(request.full_url, "http://127.0.0.1:8788/api/health")
                    self.assertEqual(request.get_header("Host"), "dragon-editor.720108.xyz")
                    self.assertEqual(opener.open.call_args.kwargs["timeout"], 5)
                    response.read.assert_called_once_with(4097)
        self.assertIsNone(monitor.NoRedirect().redirect_request(None, None, 302, "", {}, "https://example.invalid"))

    def test_command_time_and_output_budget(self):
        for code, stdout in [(1, b""), (0, b"x" * (monitor.MAX_BYTES + 1))]:
            with patch.object(monitor.subprocess, "run", return_value=MagicMock(returncode=code, stdout=stdout, stderr=b"")), self.assertRaises(ValueError):
                monitor.command(["docker", "inspect"])
        with patch.object(monitor.subprocess, "run", return_value=MagicMock(returncode=0, stdout=b"ok", stderr=b"")) as run:
            self.assertEqual(monitor.command(["docker", "inspect"]), ("ok", ""))
            self.assertEqual(run.call_args.kwargs["timeout"], 20)
            self.assertTrue(run.call_args.kwargs["capture_output"])

    def test_exceptions_are_sanitized(self):
        message_marker = "SENTINEL_PRIVATE_MUST_NOT_APPEAR"
        def broken(_):
            raise RuntimeError(message_marker)
        self.assertEqual(monitor.run(read_command=broken, now=NOW), (1, "editor monitor: observation-failed"))
        def bad_json(_):
            return message_marker, ""
        self.assertEqual(monitor.run(read_command=bad_json, now=NOW), (1, "editor monitor: observation-failed"))
        def broken_probe():
            raise RuntimeError(message_marker)
        result, _ = self.ports(probe=broken_probe)
        self.assertEqual(result, (1, "editor monitor: observation-failed"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
