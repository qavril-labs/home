# API and worker image (one image, two services). The service picks its process with the command:
#   API (default):  tsx apps/api/src/server.ts
#   Worker:         tsx apps/worker/src/main.ts
#   Migrations:     npm run migrate -w @erp/db      (run once per release, as a one-off task)
FROM node:22-slim

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY apps ./apps
COPY packages ./packages
# tsx runs the TypeScript sources directly, so it is installed with the dev dependencies.
RUN npm ci --include=dev

# Run as a non-root user.
RUN useradd --create-home --uid 10001 app && chown -R app /app
USER app

ENV HOST=0.0.0.0 PORT=3002 TRUST_PROXY=true
EXPOSE 3002

CMD ["node_modules/.bin/tsx", "apps/api/src/server.ts"]
