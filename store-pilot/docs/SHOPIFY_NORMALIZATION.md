# Shopify Normalization

Shopify objects are never exposed to AI layers. The normalizer converts GraphQL payloads into StorePilot domain models.

## Models

| StorePilot model | Source |
|------------------|--------|
| `StorePilotProduct` | Shopify Product + variants + collections + media + SEO |
| `StorePilotOrder` | Shopify Order (variant IDs only, no customer PII) |
| `StorePilotVariant` | Embedded in product |
| `StorePilotCollection` | Embedded in product |

## Normalization rules

- **IDs**: GraphQL GIDs → numeric/string IDs via `extractShopifyId`
- **Money**: String decimals → `number`
- **Status**: Shopify enum → `active | archived | draft | unknown`
- **Dates**: ISO strings preserved
- **PII**: Emails/phones redacted in text fields; blocked field names stripped

## DB mirror path

When Shopify Admin API is unavailable in worker context, `database-collector.ts` builds normalized products from existing `Product` rows (post-bootstrap sync).

## Usage

```typescript
import { normalizeShopifyProduct } from "~/knowledge/normalizer/shopify-normalizer";

const product = normalizeShopifyProduct(rawShopifyNode);
```

Validated against Zod schemas in `app/knowledge/schemas/normalized-models.ts`.
