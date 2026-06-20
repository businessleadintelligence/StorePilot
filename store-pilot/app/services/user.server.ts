import type { Session } from "@shopify/shopify-api";

import prisma from "../db.server";
import type { StoreSyncAdminClient } from "./store.server";

const OWNER_EMAIL_QUERY = `#graphql
  query StorePilotOwnerEmail {
    shop {
      email
      contactEmail
    }
  }
`;

interface OwnerEmailQueryResponse {
  data?: {
    shop?: {
      email?: string | null;
      contactEmail?: string | null;
    } | null;
  };
  errors?: Array<{ message?: string }>;
}

function logUserSync(
  level: "info" | "error",
  message: string,
  context: {
    shop: string;
    operation: string;
    storeId?: string;
    userId?: string;
    reason?: string;
  },
) {
  const payload = { message, ...context };

  if (level === "error") {
    console.error("[user-sync]", payload);
  } else {
    console.info("[user-sync]", payload);
  }
}

function normalizeEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim();
  if (!email) {
    return null;
  }

  return email.slice(0, 320);
}

interface OwnerSessionFields {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}

function getSessionIdentity(session: Session): OwnerSessionFields {
  const extended = session as Session & OwnerSessionFields;

  return {
    email: extended.email ?? null,
    firstName: extended.firstName ?? null,
    lastName: extended.lastName ?? null,
  };
}

function resolveOwnerEmail(
  shop: { email?: string | null; contactEmail?: string | null },
  session: Session,
): string | null {
  const sessionIdentity = getSessionIdentity(session);

  for (const candidate of [
    shop.email,
    shop.contactEmail,
    sessionIdentity.email,
  ]) {
    const email = normalizeEmail(candidate);
    if (email) {
      return email;
    }
  }

  return null;
}

function resolveOwnerName(session: Session): string | null {
  const sessionIdentity = getSessionIdentity(session);
  const name = [sessionIdentity.firstName, sessionIdentity.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name ? name.slice(0, 255) : null;
}

async function fetchShopEmailFields(
  admin: StoreSyncAdminClient,
  shop: string,
): Promise<{ email?: string | null; contactEmail?: string | null } | null> {
  if (process.env.USER_SYNC_SIMULATE_GRAPHQL_FAILURE === "1") {
    logUserSync("error", "Simulated GraphQL failure", {
      shop,
      operation: "owner_email_query",
      reason: "USER_SYNC_SIMULATE_GRAPHQL_FAILURE",
    });
    return null;
  }

  try {
    const response = await admin.graphql(OWNER_EMAIL_QUERY);
    const body = (await response.json()) as OwnerEmailQueryResponse;

    if (body.errors?.length) {
      logUserSync("error", "Owner email GraphQL returned errors", {
        shop,
        operation: "owner_email_query",
        reason: body.errors
          .map((error) => error.message ?? "unknown")
          .join("; "),
      });
      return null;
    }

    if (!body.data?.shop) {
      logUserSync("error", "Owner email GraphQL missing shop payload", {
        shop,
        operation: "owner_email_query",
        reason: "missing_shop_payload",
      });
      return null;
    }

    return body.data.shop;
  } catch (error) {
    logUserSync("error", "Owner email GraphQL request failed", {
      shop,
      operation: "owner_email_query",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
}

export async function upsertOwnerFromSession(
  session: Session,
  admin: StoreSyncAdminClient,
): Promise<void> {
  const shop = session.shop;

  if (!shop) {
    logUserSync("error", "Session missing shop", {
      shop: "unknown",
      operation: "upsert_owner",
      reason: "missing_session_shop",
    });
    return;
  }

  try {
    const shopEmailFields = await fetchShopEmailFields(admin, shop);
    if (!shopEmailFields) {
      return;
    }

    const email = resolveOwnerEmail(shopEmailFields, session);
    if (!email) {
      logUserSync("error", "No owner email available", {
        shop,
        operation: "upsert_owner",
        reason: "missing_owner_email",
      });
      return;
    }

    const store = await prisma.store.findUnique({
      where: { shopifyDomain: shop },
      select: { id: true },
    });

    if (!store) {
      logUserSync("error", "Store row not found for shop", {
        shop,
        operation: "upsert_owner",
        reason: "store_not_found",
      });
      return;
    }

    const name = resolveOwnerName(session);
    const lastLoginAt = new Date();

    if (process.env.USER_SYNC_SIMULATE_PRISMA_FAILURE === "1") {
      throw new Error(
        "Simulated Prisma failure (USER_SYNC_SIMULATE_PRISMA_FAILURE)",
      );
    }

    const user = await prisma.$transaction(async (tx) => {
      const existingOwner = await tx.user.findFirst({
        where: {
          storeId: store.id,
          role: "owner",
        },
      });

      if (existingOwner) {
        return tx.user.update({
          where: { id: existingOwner.id },
          data: {
            email,
            name,
            role: "owner",
            lastLoginAt,
          },
        });
      }

      return tx.user.create({
        data: {
          storeId: store.id,
          email,
          name,
          role: "owner",
          lastLoginAt,
        },
      });
    });

    logUserSync("info", "Owner upserted", {
      shop,
      operation: "upsert_owner",
      storeId: store.id,
      userId: user.id,
    });
  } catch (error) {
    logUserSync("error", "Owner upsert failed", {
      shop,
      operation: "upsert_owner",
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }
}
