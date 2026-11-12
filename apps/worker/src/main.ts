// Background worker: relays committed outbox events into BullMQ (PLT-06) and runs queue workers.
// Needs DATABASE_URL (the core database, as the non-superuser app role) and REDIS_URL.
import { OutboxDispatcher } from "@erp/events";
import { PgOutboxStore, createPool } from "@erp/db";
import { QUEUES, QueueEventSink, createQueue, createWorker, redisConnection } from "@erp/queue";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is required`);
    process.exit(1);
  }
  return value;
}

const databaseUrl = required("DATABASE_URL");
const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";
const relayEveryMs = Number(process.env.OUTBOX_RELAY_MS ?? 1000);

const pool = createPool(databaseUrl, 2);
const connection = redisConnection(redisUrl);
const eventsQueue = createQueue(QUEUES.events, connection);
const dispatcher = new OutboxDispatcher(new PgOutboxStore(pool), new QueueEventSink(eventsQueue), { batchSize: 100 });

// Consumers subscribe here as modules are built (ledger posting, bots, notifications).
// Each handler must be idempotent: BullMQ can deliver a job more than once.
const eventsWorker = createWorker(QUEUES.events, connection, async (job) => {
  console.log(JSON.stringify({ level: "info", msg: "event received", type: job.name, id: job.id }));
});

let stopping = false;
let timer: NodeJS.Timeout | undefined;

async function relay(): Promise<void> {
  if (stopping) return;
  try {
    const report = await dispatcher.runOnce();
    if (report.delivered || report.failed) {
      console.log(JSON.stringify({ level: "info", msg: "outbox relayed", ...report }));
    }
  } catch (error) {
    console.error(JSON.stringify({ level: "error", msg: "outbox relay failed", error: String(error) }));
  } finally {
    if (!stopping) timer = setTimeout(relay, relayEveryMs);
  }
}

async function shutdown(): Promise<void> {
  stopping = true;
  if (timer) clearTimeout(timer);
  await eventsWorker.close();
  await eventsQueue.close();
  connection.disconnect();
  await pool.end();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(JSON.stringify({ level: "info", msg: "worker started", redis: redisUrl.replace(/\/\/.*@/, "//***@"), relayEveryMs }));
void relay();
