# 05. AgentRuntime 与 ExecutionContext

`AgentRuntime` 是把 `AgentDefinition` 变成一次真实执行的核心模块。

## Runtime 的职责

`AgentRuntime` 负责：

```text
查找 AgentDefinition
创建 agentId
创建 ExecutionContext
解析工具列表
构造 system prompt
调用 ModelRunner
收集结果
记录 transcript
返回结构化响应
```

它不负责：

```text
定义 agent
加载 markdown
渲染 CLI UI
实现具体工具
保存业务数据
```

## 第一阶段接口

建议：

```ts
export type RunAgentInput = {
  subagentType: string;
  prompt: string;
  parentThreadId: string;
  parentAgentId?: string;
  runId?: string;
};

export type RunAgentResult = {
  status: "completed" | "failed";
  agentId: string;
  subagentType: string;
  result: string;
  error?: string;
};
```

Runtime：

```ts
export class AgentRuntime {
  constructor(
    private registry: AgentRegistry,
    private modelRunner: ModelRunner,
    private toolResolver: ToolResolver,
  ) {}

  async run(input: RunAgentInput): Promise<RunAgentResult> {
    const definition = this.registry.get(input.subagentType);
    if (!definition) {
      throw new Error(`Unknown subagent: ${input.subagentType}`);
    }

    const context = createExecutionContext(definition, input);
    const tools = this.toolResolver.resolve(definition, context);

    const output = await this.modelRunner.invoke({
      input: input.prompt,
      threadId: context.threadId,
      systemPrompt: definition.systemPrompt,
      tools,
    });

    return {
      status: "completed",
      agentId: context.agentId,
      subagentType: definition.id,
      result: extractFinalText(output),
    };
  }
}
```

## ExecutionContext 的作用

`ExecutionContext` 保存一次 agent 运行相关的状态。

建议第一阶段：

```ts
export type ExecutionContext = {
  agentId: string;
  agentType: "main" | "subagent";
  subagentType?: string;
  parentAgentId?: string;
  threadId: string;
  startedAt: Date;
  cwd: string;
};
```

后续扩展：

```ts
export type ExecutionContext = {
  agentId: string;
  agentType: "main" | "subagent" | "background";
  subagentType?: string;
  parentAgentId?: string;
  threadId: string;
  cwd: string;
  allowedTools: string[];
  readFileStateId?: string;
  memoryScope?: "thread" | "project" | "none";
  abortSignal?: AbortSignal;
  outputFile?: string;
};
```

## threadId 设计

当前 `Model.invoke(input, threadId)` 已经有 threadId。

子 agent 不应该直接复用父 threadId，否则会把主会话和子任务消息混在一起。

建议：

```text
父 threadId: user-session-1
子 threadId: user-session-1/subagent/code-reviewer/<agentId>
```

这样可以：

```text
保留父子关系
避免上下文污染
方便 transcript 查询
方便后续后台任务恢复
```

## agentId 设计

每次运行都生成新的 agentId：

```text
agent_20260709_153000_ab12cd
```

不要把 `subagentType` 当作运行 ID。

区别：

```text
subagentType = code-reviewer
agentId = 某一次 code-reviewer 运行
```

一个类型可以运行很多次。

## ModelRunner 抽象

当前 `Model.ts` 可以逐渐改造成：

```ts
export type ModelRunnerInput = {
  input: string;
  threadId: string;
  systemPrompt: string;
  tools: StructuredToolInterface[];
};

export class ModelRunner {
  async invoke(input: ModelRunnerInput) {
    const agent = createAgent({
      model: this.model,
      tools: input.tools,
      checkpointer: this.memory.getCheckpointer(),
      systemPrompt: input.systemPrompt,
    });

    return agent.invoke(
      {
        messages: [new HumanMessage(input.input)],
      },
      this.memory.getConfig(input.threadId),
    );
  }
}
```

重点是：

```text
systemPrompt 和 tools 不再固定在 constructor 里
而是每次运行由 AgentRuntime 传入
```

## 为什么要独立上下文

如果没有独立上下文，会出现：

```text
子 agent 的工具调用污染主 agent 的文件读取状态
子 agent 的 memory 混入主对话
多个后台 agent 的日志无法区分
父子任务关系丢失
权限判断不知道当前调用者是谁
```

所以 Runtime 必须把每次运行包装成一个明确的 `ExecutionContext`。

## AsyncLocalStorage 的位置

第一阶段可以先不引入 `AsyncLocalStorage`。

当出现并发后台 agent 时，再增加：

```ts
const executionContextStorage = new AsyncLocalStorage<ExecutionContext>();
```

使用方式：

```ts
runWithExecutionContext(context, async () => {
  return modelRunner.invoke(...);
});
```

这样工具内部可以读取当前上下文：

```ts
const context = getCurrentExecutionContext();
```

用于：

```text
权限校验
transcript 归属
telemetry 归属
readFileState 隔离
```

