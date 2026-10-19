#!/bin/sh
# Root-only, editor-project-only, quiesced local backup + isolated SQLite check.
# Not off-host disaster recovery, cloud-root rollback or deleted-data retention.
set -eu
[ "$(id -u)" = 0 ] || { echo 'root required' >&2; exit 1; }
umask 077
cd /srv/dragon-editor/publication
exec 9>/run/lock/dragon-editor-publication-backup.lock
flock -n 9 || { echo 'backup already running' >&2; exit 1; }
backup=/root/dragon-editor-backups/publication-$(date -u +%Y%m%dT%H%M%SZ)
mkdir -m 0700 "$backup"
running=$(docker compose ps --status running -q editor)
restart() { if [ -n "$running" ]; then docker compose up -d --no-build; fi; }
trap restart EXIT
if [ -n "$running" ]; then docker compose stop editor; fi
# Preserve exact private objects and DB as one stopped consistency boundary.
tar -czf "$backup/private.tgz" publication-data publication.env .env docker-compose.yml
cp /home/web/conf.d/dragon-editor.720108.xyz.conf "$backup/editor-nginx.conf"
docker image inspect dragon-editor-publication:$(cut -d= -f2 .env) --format '{{.Id}}' > "$backup/image-id.txt"
(cd "$backup" && sha256sum private.tgz editor-nginx.conf image-id.txt > SHA256SUMS && sha256sum -c SHA256SUMS)
mkdir -m 0700 "$backup/restore-check"
tar -xzf "$backup/private.tgz" -C "$backup/restore-check" --no-same-owner
# SQLite integrity only, no application startup, restored session use or R2 IO.
if [ -f "$backup/restore-check/publication-data/editor.sqlite" ]; then
    docker run --rm --network none --read-only --user 0:0 --cap-drop ALL \
        --security-opt no-new-privileges \
        -v "$backup/restore-check/publication-data:/restore:rw" \
        --entrypoint node dragon-editor-publication:$(cut -d= -f2 .env) \
        --input-type=module -e "import{DatabaseSync}from'node:sqlite';const db=new DatabaseSync('/restore/editor.sqlite',{readOnly:true});if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')process.exit(1);db.close();console.log('isolated SQLite restore integrity OK')"
fi
printf 'local editor backup and isolated restore check: %s\n' "$backup"
# The trap restarts only this project if it was previously running. Its strict
# startup archive/preflight may take time; readiness must be checked separately.
