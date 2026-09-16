import { RagStoreError, type RagStoreErrorCode } from "../../core/errors.ts";

function classify(message: string): {
  code: RagStoreErrorCode;
  retryable: boolean;
} {
  if (/table.*(not found|does not exist)|not found.*table/i.test(message))
    return { code: "COLLECTION_NOT_FOUND", retryable: false };
  if (/dimension|fixed.?size.?list/i.test(message))
    return { code: "VECTOR_DIMENSION_MISMATCH", retryable: false };
  if (/schema|field.*type|column.*type/i.test(message))
    return { code: "SCHEMA_MISMATCH", retryable: false };
  if (/unauthorized|forbidden|authentication|api.?key/i.test(message))
    return { code: "AUTHENTICATION_FAILED", retryable: false };
  if (/timed? out|timeout/i.test(message))
    return { code: "TIMEOUT", retryable: true };
  if (/too many requests|rate.?limit|throttl/i.test(message))
    return { code: "RATE_LIMITED", retryable: true };
  if (/connect|network|socket|temporar/i.test(message))
    return { code: "CONNECTION_FAILED", retryable: true };
  return { code: "OPERATION_FAILED", retryable: false };
}

export async function runLanceOperation<T>(
  operation: string,
  collection: string,
  action: () => Promise<T>,
): Promise<T> {
  try {
    return await action();
  } catch (cause) {
    if (cause instanceof RagStoreError) throw cause;
    const message = cause instanceof Error ? cause.message : String(cause);
    const classification = classify(message);
    throw new RagStoreError(
      classification.code,
      `LanceDB ${operation} failed for collection '${collection}'`,
      {
        operation,
        collection,
        backend: "lancedb",
        retryable: classification.retryable,
      },
      { cause },
    );
  }
}
