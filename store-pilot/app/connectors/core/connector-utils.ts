import { createHash } from "node:crypto";

export function hashStoreSeed(storeId: string): number {
  const digest = createHash("sha256").update(storeId, "utf8").digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16);
}

export function deterministicInt(seed: number, salt: string, min: number, max: number): number {
  const digest = createHash("sha256").update(`${seed}:${salt}`, "utf8").digest("hex");
  const normalized = Number.parseInt(digest.slice(0, 8), 16) / 0xffffffff;
  return Math.round(min + normalized * (max - min));
}

export function deterministicFloat(seed: number, salt: string, min: number, max: number, precision = 4): number {
  const value = deterministicInt(seed, salt, min * 10_000, max * 10_000) / 10_000;
  return Number(value.toFixed(precision));
}

export function isoNow(referenceTime?: number): string {
  return new Date(referenceTime ?? Date.now()).toISOString();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
