export const CONNECTOR_ERROR_CODES = [
  "connector_not_registered",
  "connector_connection_failed",
  "connector_fetch_failed",
  "connector_transform_failed",
  "connector_validation_failed",
  "connector_sync_failed",
  "connector_cache_miss",
] as const;

export type ConnectorErrorCode = (typeof CONNECTOR_ERROR_CODES)[number];

export class ConnectorError extends Error {
  readonly code: ConnectorErrorCode;
  readonly connectorId?: string;
  readonly cause?: unknown;

  constructor(input: {
    code: ConnectorErrorCode;
    message: string;
    connectorId?: string;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ConnectorError";
    this.code = input.code;
    this.connectorId = input.connectorId;
    this.cause = input.cause;
  }
}

export function isConnectorError(error: unknown): error is ConnectorError {
  return error instanceof ConnectorError;
}

export function toConnectorError(error: unknown, connectorId?: string): ConnectorError {
  if (isConnectorError(error)) return error;

  const message = error instanceof Error ? error.message : String(error);
  return new ConnectorError({
    code: "connector_sync_failed",
    message,
    connectorId,
    cause: error,
  });
}
