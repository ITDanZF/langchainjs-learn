import AgentModel from "../model/index.ts";
import { baseSystemPrompt } from "../model/prompts/system.ts";
import { createTools } from "../tools/index.ts";
import ToolResolver from "../tools/ToolResolver.ts";
import { createDelegateTaskTool } from "../tools/agent/delegateTask.ts";
import { guardTools } from "../security/GuardedTool.ts";
import ToolPolicy, {
  denyToolApproval,
  type ToolApprovalHandler,
} from "../security/ToolPolicy.ts";
import AgentRuntime from "./AgentRuntime.ts";
import {
  createAgentEvent,
  emitAgentEvent,
  emitToolExecutionEvent,
  type AgentEventHandler,
} from "./AgentEvent.ts";
import { createBuiltInAgentRegistry } from "./builtInAgents.ts";
import { createRootExecutionContext } from "./ExecutionContext.ts";
import RunBudget, {
  createRunAbortScope,
  DEFAULT_RUN_LIMITS,
  RunTimedOutError,
  type RunAbortScope,
  type RunLimits,
} from "./RunLimits.ts";

export type AgentGeneratorRunOptions = {
  readonly runId?: string;
  readonly threadId: string;
  readonly signal?: AbortSignal;
  readonly approval?: ToolApprovalHandler;
  readonly onChunk?: (chunk: string) => void | Promise<void>;
  readonly onAgentEvent?: AgentEventHandler;
};

export type AgentGeneratorOptions = {
  readonly approval?: ToolApprovalHandler;
  readonly policy?: ToolPolicy;
  readonly limits?: RunLimits;
};

const delegationPrompt = [
  baseSystemPrompt,
  "You can use delegate_task to assign focused text analysis, rewriting, or review work to a specialist agent.",
  "Delegate only when a specialist would materially improve the result. Use the returned result to answer the user.",
].join("\n\n");

export default class AgentGenerator {
  private readonly agent;
  private readonly registry = createBuiltInAgentRegistry();
  private readonly toolResolver = new ToolResolver();
  private readonly subagentRuntime: AgentRuntime;
  private readonly approval: ToolApprovalHandler;
  private readonly policy: ToolPolicy;
  private readonly limits: RunLimits;
  private readonly activeRuns = new Map<string, RunAbortScope>();

  constructor(options: AgentGeneratorOptions = {}) {
    this.agent = new AgentModel().getActiveAgent();
    this.approval = options.approval ?? denyToolApproval;
    this.policy = options.policy ?? new ToolPolicy();
    this.limits = options.limits ?? DEFAULT_RUN_LIMITS;
    this.subagentRuntime = new AgentRuntime(
      this.registry,
      this.agent.model,
      this.toolResolver,
      this.policy,
      this.approval,
    );
  }

  cancelRun(
    runId: string,
    reason: unknown = new Error("Agent run cancelled by user."),
  ): boolean {
    const abortScope = this.activeRuns.get(runId);
    if (!abortScope || abortScope.signal.aborted) {
      return false;
    }

    abortScope.abort(reason);
    return true;
  }

  async run(
    input: string,
    options: AgentGeneratorRunOptions,
  ): Promise<string> {
    const abortScope = createRunAbortScope(
      this.limits.timeoutMs,
      options.signal,
    );
    const budget = new RunBudget(this.limits);
    const context = createRootExecutionContext({
      runId: options.runId,
      threadId: options.threadId,
      signal: abortScope.signal,
    });
    const delegateTaskTool = createDelegateTaskTool(
      this.subagentRuntime,
      this.registry,
      {
        parentThreadId: context.threadId,
        parentRunId: context.runId,
        parentDepth: context.depth,
        signal: context.signal,
        onEvent: options.onAgentEvent,
        budget,
        approval: options.approval ?? this.approval,
      },
    );
    const tools = guardTools([...createTools(), delegateTaskTool], {
      policy: this.policy,
      approval: options.approval ?? this.approval,
      budget,
      onEvent: (event) =>
        emitToolExecutionEvent(options.onAgentEvent, context, event),
    });

    if (this.activeRuns.has(context.runId)) {
      throw new Error(`Run is already active: ${context.runId}`);
    }
    this.activeRuns.set(context.runId, abortScope);
    const chunks: string[] = [];

    try {
      await emitAgentEvent(
        options.onAgentEvent,
        createAgentEvent(context, {
          type: "run_started",
          threadId: context.threadId,
          parentRunId: context.parentRunId,
          depth: context.depth,
        }),
      );

      if (context.signal?.aborted) {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: "run_aborted",
            partialContent: "",
          }),
        );
        return "";
      }

      for await (const chunk of this.agent.model.stream({
        prompt: input,
        threadId: context.threadId,
        systemPrompt: delegationPrompt,
        tools,
        signal: context.signal,
        maxTurns: this.limits.maxTurns,
      })) {
        chunks.push(chunk);

        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: "text_delta",
            content: chunk,
          }),
        );

        await options.onChunk?.(chunk);
      }

      if (context.signal?.aborted) {
        throw context.signal.reason ?? new Error("Agent run aborted.");
      }

      const content = chunks.join("");
      await emitAgentEvent(
        options.onAgentEvent,
        createAgentEvent(context, {
          type: "run_completed",
          content,
        }),
      );
      return content;
    } catch (error) {
      const partialContent = chunks.join("");

      if (abortScope.timedOut()) {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: "run_timed_out",
            partialContent,
            timeoutMs: this.limits.timeoutMs,
          }),
        );
        throw new RunTimedOutError(this.limits.timeoutMs);
      }

      if (context.signal?.aborted) {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: "run_aborted",
            partialContent,
          }),
        );
      } else {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: "run_failed",
            partialContent,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }

      throw error;
    } finally {
      abortScope.dispose();
      this.activeRuns.delete(context.runId);
    }
  }
}
