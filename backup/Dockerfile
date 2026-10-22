FROM postgres:17-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv \
    && python3 -m venv /opt/backup-venv \
    && /opt/backup-venv/bin/pip install --no-cache-dir --timeout=120 boto3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/backup
COPY backup.py .
ENV PATH="/opt/backup-venv/bin:$PATH" PYTHONUNBUFFERED=1 PGCONNECT_TIMEOUT=5
ENTRYPOINT ["python", "backup.py"]
CMD ["worker"]
