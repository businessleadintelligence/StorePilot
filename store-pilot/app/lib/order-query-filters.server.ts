import type { Prisma } from "@prisma/client";

export const NON_REDACTED_ORDER_FILTER = {
  privacyRedacted: false,
} as const satisfies Prisma.OrderWhereInput;

export function orderWhereForMetrics(
  storeId: string,
  extra: Prisma.OrderWhereInput = {},
): Prisma.OrderWhereInput {
  return {
    storeId,
    ...NON_REDACTED_ORDER_FILTER,
    ...extra,
  };
}

export function orderWhereForMetricsInput(
  input: Prisma.OrderWhereInput,
): Prisma.OrderWhereInput {
  return {
    ...input,
    ...NON_REDACTED_ORDER_FILTER,
  };
}
