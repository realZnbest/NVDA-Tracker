/**
 * Runs `fn` over `items` with a fixed number of workers. The heatmap fans out over a
 * few dozen symbols; firing every request at once is unnecessary and makes a provider
 * rate limit more likely, while a serial loop would make a cold page wait seconds.
 * Rejections propagate, so callers that want best-effort results should catch inside
 * `fn` and return a sentinel.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const workerCount = Math.max(1, Math.min(Math.floor(limit), items.length));
  let next = 0;

  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}
