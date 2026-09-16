export type RagStoreErrorCode =
  | "INVALID_ARGUMENT"
  | "CAPABILITY_NOT_SUPPORTED"
  | "COLLECTION_NOT_FOUND"
  | "SCHEMA_MISMATCH"
  | "VECTOR_DIMENSION_MISMATCH"
  | "INDEX_NOT_READY"
  | "AUTHENTICATION_FAILED"
  | "CONNECTION_FAILED"
  | "TIMEOUT"
  | "RATE_LIMITED"
  | "OPERATION_FAILED";

export interface RagStoreErrorContext {
  operation?: string;
  collection?: string;
  backend?: string;
  retryable?: boolean;
}

export class RagStoreError extends Error {
  readonly code: RagStoreErrorCode;
  readonly operation: string | undefined;
  readonly collection: string | undefined;
  readonly backend: string | undefined;
  readonly retryable: boolean;

  constructor(
    code: RagStoreErrorCode,
    message: string,
    context: RagStoreErrorContext = {},
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "RagStoreError";
    this.code = code;
    this.operation = context.operation;
    this.collection = context.collection;
    this.backend = context.backend;
    this.retryable = context.retryable ?? false;
  }
}

export function invalidArgument(message: string, collection?: string): never {
  throw new RagStoreError(
    "INVALID_ARGUMENT",
    message,
    collection === undefined ? {} : { collection },
  );
}
