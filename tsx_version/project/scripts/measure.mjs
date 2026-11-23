const base = process.env.BASE_URL ?? "http://localhost:3000";
const samples = [];
for (let index = 0; index < 20; index++) {
  const start = performance.now();
  const response = await fetch(`${base}/api/posts?limit=10`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  await response.arrayBuffer();
  samples.push(performance.now() - start);
}
samples.sort((a, b) => a - b);
console.log(
  JSON.stringify(
    {
      requests: samples.length,
      p50ms: samples[9],
      p95ms: samples[18],
      maxMs: samples[19],
    },
    null,
    2,
  ),
);
