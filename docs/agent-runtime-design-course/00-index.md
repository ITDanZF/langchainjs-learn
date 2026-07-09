# Agent Runtime 设计教程目录

这一组文档用于指导 `mini-agent-langchain` 从一个命令行单 agent demo，演进成一套可嵌入多个智能体项目的 Agent Runtime。

这里的目标不是复刻 Claude Code 的全部复杂系统，而是提炼它最有价值的设计思想，并落到当前工程可以逐步实现的架构上。

## 核心定位

本项目后续应当沉淀为：

```text
一个可嵌入的 TypeScript Agent Runtime：
支持用声明式定义创建具备独立上下文、工具权限和可复用执行循环的智能体，
并允许主 agent 通过工具调度子 agent 完成任务。
```

CLI 只是 Runtime 的一个使用场景。真正有复用价值的是：

```text
AgentDefinition
AgentRegistry
AgentRuntime
ExecutionContext
ToolResolver
DelegateTaskTool
TaskManager
Transcript
```

## 推荐阅读顺序

1. [01-core-idea.md](./01-core-idea.md)
   先理解这套系统的核心思想：agent 不是类，而是可配置子会话。

2. [02-layered-architecture.md](./02-layered-architecture.md)
   了解系统应该拆成哪些层，每一层解决什么问题。

3. [03-agent-definition.md](./03-agent-definition.md)
   设计 `AgentDefinition`，明确 agent 如何被声明、加载、覆盖。

4. [04-registry-and-loading.md](./04-registry-and-loading.md)
   设计 `AgentRegistry`，管理内置 agent、项目 agent 和后续插件 agent。

5. [05-runtime-and-context.md](./05-runtime-and-context.md)
   设计 `AgentRuntime` 和 `ExecutionContext`，让子 agent 拥有独立执行上下文。

6. [06-tool-permission-model.md](./06-tool-permission-model.md)
   设计工具白名单、黑名单和读写权限边界。

7. [07-delegate-task-tool.md](./07-delegate-task-tool.md)
   设计主 agent 调度子 agent 的 `delegate_task` 工具。

8. [08-memory-task-transcript.md](./08-memory-task-transcript.md)
   设计记忆、后台任务、transcript 的演进方向。

9. [09-implementation-roadmap.md](./09-implementation-roadmap.md)
   给出从当前代码到 Agent Runtime 的分阶段落地路线。

## 第一阶段的最小闭环

第一阶段不要做太大，只需要完成：

```text
AgentDefinition 类型
内置 AgentRegistry
AgentRuntime.run()
ToolResolver 工具过滤
delegate_task 工具
子 agent 复用当前 LangChain createAgent 执行机制
```

完成后，系统应支持如下流程：

```text
用户向主 agent 提问
  -> 主 agent 调用 delegate_task
  -> delegate_task 选择 code-reviewer / searcher / editor 等子 agent
  -> 子 agent 使用自己的 system prompt 和工具集运行
  -> 子 agent 返回结果给主 agent
  -> 主 agent 整合回答
```

## 暂时不做的复杂能力

这些能力很有价值，但不适合第一阶段：

```text
team / swarm agent
插件 agent
per-agent MCP server
worktree 隔离
复杂 hooks
复杂 memory scope
后台并行任务 UI
```

第一阶段最重要的是把骨架写对。

