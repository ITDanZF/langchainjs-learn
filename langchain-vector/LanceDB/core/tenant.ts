import type {
  CollectionDefinition,
  RequestContext,
  TenantPolicy,
} from "./contracts.ts";
import { RagStoreError } from "./errors.ts";
import { filter, type FilterExpression } from "../filters/index.ts";

export class RequiredTenantPolicy implements TenantPolicy {
  scope<T extends object>(
    context: RequestContext,
    definition: CollectionDefinition<T>,
  ): FilterExpression<T> | undefined {
    if (!definition.tenantKey) return undefined;
    if (!context.tenantId) {
      throw new RagStoreError(
        "INVALID_ARGUMENT",
        `Collection '${definition.name}' requires tenant context`,
        { collection: definition.name },
      );
    }
    return filter.eq<T>(definition.tenantKey, context.tenantId);
  }
}
