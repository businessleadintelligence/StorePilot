import type { KnowledgeEvent } from "../shared/types";

export type KnowledgeEventSink = {
  emit(event: KnowledgeEvent): void | Promise<void>;
};

export class InMemoryKnowledgeEventSink implements KnowledgeEventSink {
  readonly events: KnowledgeEvent[] = [];

  emit(event: KnowledgeEvent): void {
    this.events.push(event);
  }
}

export class LoggingKnowledgeEventSink implements KnowledgeEventSink {
  emit(event: KnowledgeEvent): void {
    console.info("[knowledge-event]", event);
  }
}

export class KnowledgeEventEmitter {
  constructor(private readonly sinks: KnowledgeEventSink[] = [new LoggingKnowledgeEventSink()]) {}

  emit(input: Omit<KnowledgeEvent, "timestamp"> & { timestamp?: string }): void {
    const event: KnowledgeEvent = {
      ...input,
      timestamp: input.timestamp ?? new Date().toISOString(),
    };
    for (const sink of this.sinks) {
      void sink.emit(event);
    }
  }

  productImported(storeId: string, entityId: string): void {
    this.emit({ type: "ProductImported", storeId, entity: "Product", entityId });
  }

  inventoryUpdated(storeId: string, entityId: string): void {
    this.emit({ type: "InventoryUpdated", storeId, entity: "Variant", entityId });
  }

  orderImported(storeId: string, entityId: string): void {
    this.emit({ type: "OrderImported", storeId, entity: "Order", entityId });
  }

  productArchived(storeId: string, entityId: string): void {
    this.emit({ type: "ProductArchived", storeId, entity: "Product", entityId });
  }

  productDeleted(storeId: string, entityId: string): void {
    this.emit({ type: "ProductDeleted", storeId, entity: "Product", entityId });
  }

  evidenceCreated(
    storeId: string,
    entityId: string,
    factType: KnowledgeEvent["factType"],
    entity: KnowledgeEvent["entity"] = "Product",
  ): void {
    this.emit({ type: "EvidenceCreated", storeId, entity, entityId, factType });
  }

  evidenceUpdated(
    storeId: string,
    entityId: string,
    factType: KnowledgeEvent["factType"],
    entity: KnowledgeEvent["entity"] = "Product",
  ): void {
    this.emit({ type: "EvidenceUpdated", storeId, entity, entityId, factType });
  }

  evidenceExpired(
    storeId: string,
    entityId: string,
    factType: KnowledgeEvent["factType"],
    entity: KnowledgeEvent["entity"] = "Product",
  ): void {
    this.emit({ type: "EvidenceExpired", storeId, entity, entityId, factType });
  }
}

export function createKnowledgeEventEmitter(
  sinks?: KnowledgeEventSink[],
): KnowledgeEventEmitter {
  return new KnowledgeEventEmitter(sinks);
}
