// Load test for the local API. Measures latency and error rate for a few read and write paths.
// Usage: node backend/scripts/load-test.mjs [baseUrl] [seconds] [concurrency]
// It signs up a fresh workspace, so it never touches an existing business's books.
const base = process.argv[2] || "http://127.0.0.1:3002";
const seconds = Number(process.argv[3] || 20);
const concurrency = Number(process.argv[4] || 10);

const post = (path, body, headers = {}) =>
  fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });

const id = Date.now().toString(36);
const signup = await post("/v1/public/signup", {
  name: "Load Test", email: `load-${id}@example.test`, password: "a long load test password",
  company: `Load ${id}`, countryCode: "US", baseCurrency: "USD", region: "US", consent: true,
});
if (signup.status !== 201) throw new Error(`signup failed: ${signup.status}`);
const token = (await signup.json()).session.token;
const auth = { authorization: `Bearer ${token}` };

const routes = [
  { name: "GET /health", run: () => fetch(base + "/health") },
  { name: "GET /v1/workspace/overview", run: () => fetch(base + "/v1/workspace/overview", { headers: auth }) },
  { name: "GET /v1/workspace/insights", run: () => fetch(base + "/v1/workspace/insights", { headers: auth }) },
  {
    name: "POST /v1/workspace/quick-entries",
    run: () => post("/v1/workspace/quick-entries", { kind: "owner_investment", amount: "1.00", date: "2026-11-02", via: "1100", memo: "load" }, auth),
  },
];

const stats = new Map(routes.map((r) => [r.name, { ok: 0, failed: 0, times: [] }]));
const deadline = Date.now() + seconds * 1000;

async function worker(route) {
  const s = stats.get(route.name);
  while (Date.now() < deadline) {
    const start = performance.now();
    try {
      const res = await route.run();
      await res.arrayBuffer();
      s.times.push(performance.now() - start);
      if (res.status < 500 && res.status !== 429) s.ok += 1; else s.failed += 1;
    } catch {
      s.failed += 1;
    }
  }
}

const started = Date.now();
await Promise.all(routes.flatMap((r) => Array.from({ length: concurrency }, () => worker(r))));
const elapsed = (Date.now() - started) / 1000;

const pct = (arr, p) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};
console.log(`base=${base} concurrency=${concurrency} seconds=${elapsed.toFixed(1)}`);
console.log("route | requests | rps | errors | p50 ms | p95 ms | p99 ms");
for (const [name, s] of stats) {
  const total = s.ok + s.failed;
  console.log(
    `${name} | ${total} | ${(total / elapsed).toFixed(1)} | ${s.failed} | ${pct(s.times, 50).toFixed(1)} | ${pct(s.times, 95).toFixed(1)} | ${pct(s.times, 99).toFixed(1)}`,
  );
}
