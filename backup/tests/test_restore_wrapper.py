import os
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RESTORE = ROOT / "scripts" / "restore.sh"
KEY = "backups/2026-10-05/20261005T123456Z-0123456789abcdef0123456789abcdef.dump"


class RestoreWrapperTests(unittest.TestCase):
    def run_restore(self, running, restore_exit=0, answer="restore\n"):
        with tempfile.TemporaryDirectory() as tmp:
            bin_dir = Path(tmp) / "bin"
            bin_dir.mkdir()
            log = Path(tmp) / "calls"
            docker = bin_dir / "docker"
            docker.write_text("""#!/bin/sh
printf '%s\\n' "$*" >> "$MOCK_LOG"
if [ "$1 $2 $3" = "compose ps --status" ]; then
    printf '%s\\n' "$MOCK_RUNNING"
elif [ "$1 $2" = "compose run" ]; then
    exit "$MOCK_RESTORE_EXIT"
fi
""")
            docker.chmod(0o755)
            env = {**os.environ, "PATH": f"{bin_dir}:{os.environ['PATH']}", "MOCK_LOG": str(log), "MOCK_RUNNING": running, "MOCK_RESTORE_EXIT": str(restore_exit)}
            result = subprocess.run([str(RESTORE), KEY], input=answer, text=True, capture_output=True, env=env)
            return result, log.read_text().splitlines() if log.exists() else []

    def test_running_app_and_worker_restart_after_success_or_failure(self):
        for code in (0, 1):
            with self.subTest(code=code):
                result, calls = self.run_restore("app\nbackup", restore_exit=code)
                self.assertEqual(result.returncode, code)
                self.assertIn("compose stop app backup", calls)
                self.assertIn("compose start app", calls)
                self.assertIn("compose start backup", calls)

    def test_initially_stopped_services_stay_stopped(self):
        result, calls = self.run_restore("")
        self.assertEqual(result.returncode, 0)
        self.assertFalse(any(call.startswith("compose start ") for call in calls))

    def test_cancelled_confirmation_does_not_stop_services(self):
        result, calls = self.run_restore("app\nbackup", answer="no\n")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(calls, [])


if __name__ == "__main__":
    unittest.main()
