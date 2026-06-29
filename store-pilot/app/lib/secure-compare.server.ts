import { timingSafeEqual } from "node:crypto";

export function secureCompareStrings(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(providedBuffer, expectedBuffer);
}
