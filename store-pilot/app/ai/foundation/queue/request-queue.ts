export type FoundationQueuedRequest = {
  id: string;
  enqueuedAt: string;
  payload: unknown;
};

export interface FoundationRequestQueue {
  enqueue(payload: unknown): FoundationQueuedRequest;
  dequeue(): FoundationQueuedRequest | null;
  size(): number;
}

export class InMemoryFoundationRequestQueue implements FoundationRequestQueue {
  private readonly queue: FoundationQueuedRequest[] = [];

  enqueue(payload: unknown): FoundationQueuedRequest {
    const item: FoundationQueuedRequest = {
      id: crypto.randomUUID(),
      enqueuedAt: new Date().toISOString(),
      payload,
    };
    this.queue.push(item);
    return item;
  }

  dequeue(): FoundationQueuedRequest | null {
    return this.queue.shift() ?? null;
  }

  size(): number {
    return this.queue.length;
  }
}

export function createFoundationRequestQueue(): FoundationRequestQueue {
  return new InMemoryFoundationRequestQueue();
}
