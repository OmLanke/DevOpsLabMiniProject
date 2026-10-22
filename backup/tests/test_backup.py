import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from backup import backup

KEY = "backups/2026-10-05/20261005T123456Z-0123456789abcdef0123456789abcdef.dump"


class FakeS3:
    def __init__(self, manifest, archive=b"dump bytes", *, manifest_upload_error=None, download_error=None, pages=()):
        self.manifest = manifest
        self.archive = archive
        self.manifest_upload_error = manifest_upload_error
        self.download_error = download_error
        self.pages = pages
        self.uploads = {}
        self.deleted = []

    def head_bucket(self, **_kwargs):
        pass

    def put_bucket_versioning(self, **_kwargs):
        pass

    def upload_file(self, path, bucket, key):
        self.uploads[key] = Path(path).read_bytes()

    def put_object(self, **kwargs):
        if self.manifest_upload_error:
            raise self.manifest_upload_error
        self.uploads[kwargs["Key"]] = kwargs["Body"]

    def delete_object(self, **kwargs):
        self.deleted.append(kwargs["Key"])
        self.uploads.pop(kwargs["Key"], None)

    def get_paginator(self, _operation):
        return self

    def paginate(self, **_kwargs):
        yield from self.pages

    def download_file(self, _bucket, key, path):
        if self.download_error and not key.endswith(".json"):
            raise self.download_error
        content = self.manifest if key.endswith(".json") else self.archive
        if isinstance(content, dict):
            content = json.dumps(content).encode()
        Path(path).write_bytes(content)


class BackupTests(unittest.TestCase):
    def setUp(self):
        self.archive = b"dump bytes"
        self.manifest = {"key": KEY, "database": "notes", "sha256": hashlib.sha256(self.archive).hexdigest(), "size_bytes": len(self.archive)}

    def test_backup_uploads_unique_dump_and_manifest_with_checksum(self):
        client = FakeS3(self.manifest)

        def fake_dump(command, **_kwargs):
            Path(command[command.index("--file") + 1]).write_bytes(self.archive)

        with patch.object(backup.subprocess, "run", side_effect=fake_dump):
            with patch.dict(os.environ, {"PGDATABASE": "notes"}):
                key1 = backup.create_backup(client)
                key2 = backup.create_backup(client)

        self.assertNotEqual(key1, key2)
        self.assertEqual(client.uploads[key1], self.archive)
        metadata = json.loads(client.uploads[key1.removesuffix(".dump") + ".json"])
        self.assertEqual(metadata["sha256"], hashlib.sha256(self.archive).hexdigest())
        self.assertEqual(metadata["size_bytes"], len(self.archive))

    def test_dump_failure_uploads_nothing(self):
        client = FakeS3(self.manifest)
        with patch.object(backup.subprocess, "run", side_effect=backup.subprocess.CalledProcessError(1, "pg_dump")):
            with self.assertRaises(backup.subprocess.CalledProcessError):
                backup.create_backup(client)
        self.assertEqual(client.uploads, {})

    def test_manifest_upload_failure_removes_dump_and_propagates(self):
        client = FakeS3(self.manifest, manifest_upload_error=RuntimeError("upload failed"))

        def fake_dump(command, **_kwargs):
            Path(command[command.index("--file") + 1]).write_bytes(self.archive)

        with patch.object(backup.subprocess, "run", side_effect=fake_dump):
            with self.assertRaisesRegex(RuntimeError, "upload failed"):
                backup.create_backup(client)
        self.assertEqual(len(client.deleted), 1)
        self.assertTrue(client.deleted[0].endswith(".dump"))
        self.assertEqual(client.uploads, {})

    def test_list_paginates_and_shows_only_complete_pairs_newest_first(self):
        from contextlib import redirect_stdout
        from datetime import datetime, timezone
        from io import StringIO

        newer = "backups/2026-10-06/20261006T123456Z-0123456789abcdef0123456789abcdef.dump"
        orphan = "backups/2026-10-07/20261007T123456Z-0123456789abcdef0123456789abcdef.dump"
        def obj(key, day):
            return {"Key": key, "LastModified": datetime(2026, 10, day, tzinfo=timezone.utc), "Size": 10}

        client = FakeS3(self.manifest, pages=[
            {"Contents": [obj(KEY, 5), obj(KEY.removesuffix(".dump") + ".json", 5), obj(orphan, 7)]},
            {"Contents": [obj(newer, 6), obj(newer.removesuffix(".dump") + ".json", 6)]},
        ])
        output = StringIO()
        with redirect_stdout(output):
            backup.list_backups(client)
        listed = [line.split("\t")[-1] for line in output.getvalue().splitlines()]
        self.assertEqual(listed, [newer, KEY])

    def test_invalid_manifest_metadata_never_calls_pg_restore(self):
        cases = [
            ({**self.manifest, "database": "other"}, "unexpected database"),
            ({**self.manifest, "size_bytes": len(self.archive) + 1}, "size does not match"),
            (b"{invalid json", "missing or invalid"),
        ]
        for manifest, message in cases:
            with self.subTest(message=message):
                client = FakeS3(manifest, self.archive)
                with patch.dict(os.environ, {"PGDATABASE": "notes"}):
                    with patch.object(backup.subprocess, "run") as run:
                        with self.assertRaisesRegex(ValueError, message):
                            backup.restore_backup(client, KEY, yes=True)
                run.assert_not_called()

    def test_dump_download_failure_never_calls_pg_restore(self):
        client = FakeS3(self.manifest, self.archive, download_error=FileNotFoundError("missing dump"))
        with patch.dict(os.environ, {"PGDATABASE": "notes"}):
            with patch.object(backup.subprocess, "run") as run:
                with self.assertRaisesRegex(FileNotFoundError, "missing dump"):
                    backup.restore_backup(client, KEY, yes=True)
        run.assert_not_called()

    def test_checksum_failure_never_calls_pg_restore(self):
        client = FakeS3({**self.manifest, "sha256": "0" * 64})
        with patch.dict(os.environ, {"PGDATABASE": "notes"}):
            with patch.object(backup.subprocess, "run") as run:
                with self.assertRaisesRegex(ValueError, "checksum does not match"):
                    backup.restore_backup(client, KEY, yes=True)
        run.assert_not_called()

    def test_valid_restore_is_transactional_and_fails_on_sql_errors(self):
        client = FakeS3(self.manifest, self.archive)
        with patch.dict(os.environ, {"PGDATABASE": "notes"}):
            with patch.object(backup.subprocess, "run") as run:
                backup.restore_backup(client, KEY, yes=True)
        command = run.call_args.args[0]
        self.assertIn("--single-transaction", command)
        self.assertIn("--exit-on-error", command)
        self.assertEqual(command[command.index("--dbname") + 1], "notes")
        self.assertIn("--clean", command)
        self.assertIn("--if-exists", command)

    def test_manifest_must_match_expected_key(self):
        with self.assertRaisesRegex(ValueError, "manifest does not match"):
            backup.validate_manifest({**self.manifest, "key": "backups/other.dump"}, KEY)

    def test_object_keys_cannot_escape_backup_prefix(self):
        with self.assertRaisesRegex(ValueError, "backup key"):
            backup.validate_key("backups/../secret.dump")


if __name__ == "__main__":
    unittest.main()
