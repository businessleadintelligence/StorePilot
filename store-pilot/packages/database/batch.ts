/**
 * Run async work in bounded parallel batches to avoid pool exhaustion.
 * Preserves result order relative to the input array.
 */
export async function runInParallelBatches<TInput, TOutput>(
  items: TInput[],
  batchSize: number,
  worker: (item: TInput, index: number) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const size = Math.max(1, batchSize);
  const results = new Array<TOutput>(items.length);

  for (let offset = 0; offset < items.length; offset += size) {
    const slice = items.slice(offset, offset + size);
    const batchResults = await Promise.all(
      slice.map((item, indexWithinBatch) =>
        worker(item, offset + indexWithinBatch),
      ),
    );

    for (let index = 0; index < batchResults.length; index += 1) {
      results[offset + index] = batchResults[index] as TOutput;
    }
  }

  return results;
}
