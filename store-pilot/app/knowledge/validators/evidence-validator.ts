import type { EvidenceDraft } from "../shared/types";

export class EvidenceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EvidenceValidationError";
  }
}

export function validateEvidenceDraft(draft: EvidenceDraft): void {
  if (!draft.entityId.trim()) {
    throw new EvidenceValidationError("Unknown entity: empty entityId");
  }
  if (!draft.factType.trim()) {
    throw new EvidenceValidationError("Invalid fact: empty factType");
  }
  if (Number.isNaN(draft.observedAt.getTime())) {
    throw new EvidenceValidationError("Impossible timestamp on evidence draft");
  }
  if (typeof draft.value === "number" && draft.value < 0 && draft.factType.includes("Inventory")) {
    throw new EvidenceValidationError("Negative inventory value rejected");
  }
}

export function validateObservationDedupeKey(dedupeKey: string): void {
  if (!dedupeKey.trim()) {
    throw new EvidenceValidationError("Missing observation dedupe key");
  }
}

export function validateSourcePresent(sourceId: string | null | undefined): void {
  if (!sourceId) {
    throw new EvidenceValidationError("Missing evidence source");
  }
}
