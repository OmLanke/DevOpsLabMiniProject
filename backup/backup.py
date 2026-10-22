#!/usr/bin/env python3
"""Create, list, and restore versioned PostgreSQL backups in S3-compatible storage."""

import argparse
import hashlib
import json
import logging
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

LOG = logging.getLogger("backup")
KEY_PATTERN = re.compile(r"^backups/\d{4}-\d{2}-\d{2}/\d{8}T\d{6}Z-[0-9a-f]{32}\.dump$")
STOP = False


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def validate_key(key):
    if not KEY_PATTERN.fullmatch(key):
        raise ValueError("backup key must be a backups/YYYY-MM-DD/<timestamp>-<uuid>.dump object key")
    return key


def validate_manifest(manifest, key):
    validate_key(key)
    if not isinstance(manifest, dict) or manifest.get("key") != key:
        raise ValueError("backup manifest does not match the requested object")
    if manifest.get("database") != os.environ.get("PGDATABASE", "notes"):
        raise ValueError("backup manifest names an unexpected database")
    checksum = manifest.get("sha256")
    if not isinstance(checksum, str) or not re.fullmatch(r"[0-9a-f]{64}", checksum):
        raise ValueError("backup manifest has an invalid SHA-256 checksum")
    if not isinstance(manifest.get("size_bytes"), int) or manifest["size_bytes"] < 0:
        raise ValueError("backup manifest has an invalid size")
    return manifest


def s3_client():
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        endpoint_url=os.environ.get("S3_ENDPOINT_URL", "http://minio:9000"),
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID", "minioadmin"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY", "minioadmin"),
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
        config=Config(connect_timeout=5, read_timeout=30, retries={"max_attempts": 2}, s3={"addressing_style": "path"}),
    )


def bucket_name():
    return os.environ.get("BACKUP_BUCKET", "notes-backups")


def ensure_bucket(client):
    bucket = bucket_name()
    try:
        client.head_bucket(Bucket=bucket)
    except Exception as error:
        code = getattr(error, "response", {}).get("Error", {}).get("Code")
        if code not in {"404", "NoSuchBucket", "NotFound"}:
            raise
        try:
            client.create_bucket(Bucket=bucket)
        except Exception as create_error:
            create_code = getattr(create_error, "response", {}).get("Error", {}).get("Code")
            if create_code not in {"BucketAlreadyOwnedByYou", "BucketAlreadyExists"}:
                raise
    client.put_bucket_versioning(Bucket=bucket, VersioningConfiguration={"Status": "Enabled"})


def create_backup(client):
    ensure_bucket(client)
    timestamp = datetime.now(timezone.utc)
    stamp = timestamp.strftime("%Y%m%dT%H%M%SZ")
    key = f"backups/{timestamp:%Y-%m-%d}/{stamp}-{uuid.uuid4().hex}.dump"
    with tempfile.TemporaryDirectory(prefix="notes-backup-") as tmp:
        dump_path = Path(tmp) / "database.dump"
        command = ["pg_dump", "--format=custom", "--compress=6", "--no-owner", "--no-acl", "--file", str(dump_path)]
        LOG.info("creating PostgreSQL dump for database %s", os.environ.get("PGDATABASE", "notes"))
        subprocess.run(command, check=True, stdout=subprocess.DEVNULL)
        checksum = sha256(dump_path)
        manifest = {
            "key": key,
            "timestamp": timestamp.isoformat(),
            "database": os.environ.get("PGDATABASE", "notes"),
            "file_name": Path(key).name,
            "sha256": checksum,
            "size_bytes": dump_path.stat().st_size,
            "application_version": os.environ.get("APP_VERSION", "dev"),
        }
        client.upload_file(str(dump_path), bucket_name(), key)
        try:
            client.put_object(
                Bucket=bucket_name(),
                Key=key.removesuffix(".dump") + ".json",
                Body=json.dumps(manifest, indent=2, sort_keys=True).encode(),
                ContentType="application/json",
            )
        except Exception:
            try:
                client.delete_object(Bucket=bucket_name(), Key=key)
            except Exception:
                LOG.exception("could not remove incomplete backup object %s", key)
            raise
    LOG.info("uploaded %s (%s bytes, sha256 %s)", key, manifest["size_bytes"], checksum)
    return key


def list_backups(client):
    ensure_bucket(client)
    paginator = client.get_paginator("list_objects_v2")
    objects = [obj for page in paginator.paginate(Bucket=bucket_name(), Prefix="backups/") for obj in page.get("Contents", [])]
    manifests = {obj["Key"] for obj in objects if obj["Key"].endswith(".json")}
    backups = [obj for obj in objects if KEY_PATTERN.fullmatch(obj["Key"]) and obj["Key"].removesuffix(".dump") + ".json" in manifests]
    for obj in sorted(backups, key=lambda item: item["LastModified"], reverse=True):
        print(f"{obj['LastModified'].isoformat()}\t{obj['Size']}\t{obj['Key']}")
    LOG.info("listed %d backups", len(backups))


def verify_backup(path, manifest):
    if path.stat().st_size != manifest["size_bytes"]:
        raise ValueError("backup size does not match its manifest; database was not changed")
    if sha256(path) != manifest["sha256"]:
        raise ValueError("backup checksum does not match its manifest; database was not changed")


def confirm_restore(key, yes):
    if yes:
        return
    print(f"WARNING: restoring {key} will replace objects in database {os.environ.get('PGDATABASE', 'notes')}.", file=sys.stderr)
    try:
        answer = input("Type 'restore' to continue: ")
    except EOFError:
        answer = ""
    if answer != "restore":
        raise RuntimeError("restore cancelled; pass --yes to confirm non-interactively")


def restore_backup(client, key, yes=False):
    validate_key(key)
    confirm_restore(key, yes)
    ensure_bucket(client)
    manifest_key = key.removesuffix(".dump") + ".json"
    with tempfile.TemporaryDirectory(prefix="notes-restore-") as tmp:
        dump_path = Path(tmp) / "database.dump"
        manifest_path = Path(tmp) / "manifest.json"
        client.download_file(bucket_name(), manifest_key, str(manifest_path))
        try:
            manifest = validate_manifest(json.loads(manifest_path.read_text()), key)
        except (json.JSONDecodeError, OSError) as error:
            raise ValueError("backup manifest is missing or invalid") from error
        client.download_file(bucket_name(), key, str(dump_path))
        verify_backup(dump_path, manifest)
        LOG.info("verified %s; restoring database %s", key, manifest["database"])
        subprocess.run([
            "pg_restore", "--clean", "--if-exists", "--no-owner", "--no-acl",
            "--single-transaction", "--exit-on-error", "--dbname", manifest["database"], str(dump_path),
        ], check=True, stdout=subprocess.DEVNULL)
    LOG.info("restore completed from %s", key)


def worker(client):
    interval = int(os.environ.get("BACKUP_INTERVAL_SECONDS", "300"))
    if interval < 1:
        raise ValueError("BACKUP_INTERVAL_SECONDS must be a positive integer")
    while not STOP:
        try:
            create_backup(client)
        except Exception:
            LOG.exception("scheduled backup failed")
        for _ in range(interval):
            if STOP:
                break
            time.sleep(1)


def stop_worker(_signum, _frame):
    global STOP
    STOP = True


def main(argv=None):
    logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO").upper(), format="%(asctime)s %(levelname)s %(message)s", stream=sys.stderr)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("backup")
    commands.add_parser("list")
    restore = commands.add_parser("restore")
    restore.add_argument("key")
    restore.add_argument("--yes", action="store_true", help="confirm replacing database objects")
    commands.add_parser("worker")
    args = parser.parse_args(argv)
    try:
        client = s3_client()
        if args.command == "backup":
            print(create_backup(client), flush=True)
        elif args.command == "list":
            list_backups(client)
        elif args.command == "restore":
            restore_backup(client, args.key, args.yes)
        else:
            signal.signal(signal.SIGTERM, stop_worker)
            signal.signal(signal.SIGINT, stop_worker)
            worker(client)
    except Exception as error:
        LOG.error("%s", error)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
