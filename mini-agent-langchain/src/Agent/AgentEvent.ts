import type { ExecutionContext } from "./ExecutionContext.ts";

export type AgentEventSource = Pick<
  ExecutionContext,
  "runId" | "agentType"
>;

export type AgentEventPayload =
  | {
      readonly type: "run_started";
      readonly threadId: string;
      readonly parentRunId?: string;
      readonly depth: number;
    }
  | {
      readonly type: "text_delta";
      readonly content: string;
    }
  | {
      readonly type: "run_completed";
      readonly content: string;
    }
  | {
      readonly type: "run_aborted";
      readonly partialContent: string;
    }
  | {
      readonly type: "run_failed";
      readonly partialContent: string;
      readonly error: string;
    };

export type AgentEvent = AgentEventSource & AgentEventPayload;

export type AgentEventHandler = (
  event: AgentEvent,
) => void | Promise<void>;

export function createAgentEvent(
  source: AgentEventSource,
  payload: AgentEventPayload,
): AgentEvent {
  return Object.freeze({
    ...payload,
    runId: source.runId,
    agentType: source.agentType,
  }) as AgentEvent;
}

export async function emitAgentEvent(
  handler: AgentEventHandler | undefined,
  event: AgentEvent,
): Promise<void> {
  await handler?.(event);
}
