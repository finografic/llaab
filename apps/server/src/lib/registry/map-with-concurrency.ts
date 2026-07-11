/** Map over an array with limited concurrency (ported from npmx.dev). */
export async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  concurrency = 10,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length }) as R[];
  let currentIndex = 0;

  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      results[index] = await fn(items[index]!, index);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}
