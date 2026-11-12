import { createPool } from "@erp/db";
import { buildApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig(process.env);
const app = buildApp({
  pool: createPool(config.databaseUrl),
  platformKey: config.platformKey,
  corsOrigins: config.corsOrigins,
  trustProxy: config.trustProxy,
  leadWebhookUrl: config.leadWebhookUrl,
  logger: true,
});

await app.listen({ port: config.port, host: config.host });
