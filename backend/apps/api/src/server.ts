import { createPool } from "@erp/db";
import { redisConnection } from "@erp/queue";
import { RedisTicketStore } from "./stream-tickets";
import { buildApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig(process.env);
const app = buildApp({
  pool: createPool(config.databaseUrl),
  platformKey: config.platformKey,
  corsOrigins: config.corsOrigins,
  trustProxy: config.trustProxy,
  leadWebhookUrl: config.leadWebhookUrl,
  // Tickets are shared through Redis when it is configured, so any instance can accept one.
  ticketStore: config.redisUrl ? new RedisTicketStore(redisConnection(config.redisUrl)) : undefined,
  logger: true,
});

await app.listen({ port: config.port, host: config.host });
