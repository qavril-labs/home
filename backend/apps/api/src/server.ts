import { createPool } from "@erp/db";
import { QUEUES, createQueue, redisConnection } from "@erp/queue";
import { RedisTicketStore } from "./stream-tickets";
import { RedisRealtimeBus } from "./realtime-bus";
import { realtimeEvents } from "./invoicing-routes";
import { buildApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig(process.env);
// Live events fan out to every instance through Redis when it is configured.
if (config.redisUrl) {
  realtimeEvents.attachBus(new RedisRealtimeBus(redisConnection(config.redisUrl), redisConnection(config.redisUrl)));
}

const app = buildApp({
  pool: createPool(config.databaseUrl),
  platformKey: config.platformKey,
  corsOrigins: config.corsOrigins,
  trustProxy: config.trustProxy,
  leadWebhookUrl: config.leadWebhookUrl,
  // Tickets are shared through Redis when it is configured, so any instance can accept one.
  ticketStore: config.redisUrl ? new RedisTicketStore(redisConnection(config.redisUrl)) : undefined,
  // Email goes through the notifications queue, which the worker drains. Needs Redis.
  emailQueue: config.redisUrl ? createQueue(QUEUES.notifications, redisConnection(config.redisUrl)) : undefined,
  logger: true,
});

await app.listen({ port: config.port, host: config.host });
