# VPS editor auth image. Build context is the app directory containing
# server/, vps/ and web/src (no web/content: 200M+ runtime assets are not
# needed; production baselines come from installed sources, not the repo).
# No secrets here; they arrive at runtime via Compose env_file.
FROM node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392
WORKDIR /app
COPY server/ ./server/
COPY vps/sqlite-port.mjs vps/auth-server.mjs vps/server-main.mjs ./vps/
COPY web/src/ ./web/src/
USER node
EXPOSE 8788
CMD ["node", "vps/server-main.mjs"]
