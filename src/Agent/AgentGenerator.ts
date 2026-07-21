import AgentModel from "../model/index.ts";
import { baseSystemPrompt } from '../model/prompts/system.ts';
import { createTools } from '../tools/index.ts';

import ToolResolver from '../tools/ToolResolver.ts';
import { createDelegateTaskTool } from '../tools/agent/delegateTask.ts';
import AgentRuntime from './AgentRuntime.ts';
import {
  createAgentEvent,
  emitAgentEvent,
  type AgentEventHandler,
} from './AgentEvent.ts';
import { createBuiltInAgentRegistry } from './builtInAgents.ts';
import { createRootExecutionContext } from './ExecutionContext.ts';

export type AgentGeneratorRunOptions = {
  readonly threadId: string;
  readonly signal?: AbortSignal;
  readonly onChunk?: (chunk: string) => void | Promise<void>;
  readonly onAgentEvent?: AgentEventHandler;
};

const delegationPrompt = [
  baseSystemPrompt,
  'You can use delegate_task to assign focused text analysis, rewriting, or review work to a specialist agent.',
  'Delegate only when a specialist would materially improve the result. Use the returned result to answer the user.',
].join('\n\n');

export default class AgentGenerator {
  private readonly agent;
  private readonly registry = createBuiltInAgentRegistry();
  private readonly toolResolver = new ToolResolver();
  private readonly subagentRuntime: AgentRuntime;

  constructor() {
    this.agent = new AgentModel().getActiveAgent();
    this.subagentRuntime = new AgentRuntime(
      this.registry,
      this.agent.model,
      this.toolResolver,
    );
  }

  async run(
    input: string,
    options: AgentGeneratorRunOptions,
  ): Promise<string> {
    if (this.agent.status === 'running') {
      throw new Error('Agent is already running.');
    }

    if (this.agent.status === 'disabled') {
      throw new Error('Agent is disabled.');
    }

    const context = createRootExecutionContext({
      threadId: options.threadId,
      signal: options.signal,
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
      },
    );

    this.agent.status = 'running';
    const chunks: string[] = [];

    try {
      await emitAgentEvent(
        options.onAgentEvent,
        createAgentEvent(context, {
          type: 'run_started',
          threadId: context.threadId,
          parentRunId: context.parentRunId,
          depth: context.depth,
        }),
      );

      if (context.signal?.aborted) {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: 'run_aborted',
            partialContent: '',
          }),
        );

        return '';
      }

      for await (const chunk of this.agent.model.stream({
        prompt: input,
        threadId: context.threadId,
        systemPrompt: delegationPrompt,
        tools: [...createTools(), delegateTaskTool],
        signal: context.signal,
      })) {
        chunks.push(chunk);

        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: 'text_delta',
            content: chunk,
          }),
        );

        await options.onChunk?.(chunk);
      }

      const content = chunks.join('');

      await emitAgentEvent(
        options.onAgentEvent,
        createAgentEvent(context, {
          type: 'run_completed',
          content,
        }),
      );

      return content;
    } catch (error) {
      const partialContent = chunks.join('');

      if (context.signal?.aborted) {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: 'run_aborted',
            partialContent,
          }),
        );
      } else {
        await emitAgentEvent(
          options.onAgentEvent,
          createAgentEvent(context, {
            type: 'run_failed',
            partialContent,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }

      throw error;
    } finally {
      this.agent.status = 'idle';
    }
  }
}
