# 02. 分层架构设计

Agent Runtime 应该分层设计。分层的目的不是形式化，而是让每个模块只解决一类问题。

## 总体分层

```text
Agent 定义层
  AgentDefinition / markdown agent / built-in agent
        |
        v
Agent 注册层
  AgentRegistry / 加载 / 覆盖 / 查询
        |
        v
Agent 调度层
  delegate_task / 选择 agent / 参数校验
        |
        v
Agent 执行层
  AgentRuntime / ExecutionContext / ToolResolver
        |
        v
模型与工具循环
  LangChain createAgent / model.invoke / tools
        |
        v
生命周期层
  transcript / task / memory / notifications
```

## 1. Agent 定义层

定义层负责描述 agent，而不是运行 agent。

核心产物：

```text
AgentDefinition
BuiltInAgentDefinition
MarkdownAgentDefinition
PluginAgentDefinition
```

第一阶段只需要：

```text
BuiltInAgentDefinition
```

未来再增加 markdown 和 plugin。

## 2. Agent 注册层

注册层负责把所有来源的 agent 合并成可查询列表。

职责：

```text
注册内置 agent
加载项目 agent
加载用户 agent
处理同名覆盖
返回 active agent
暴露 list/get/find API
```

建议模块：

```text
src/agent/AgentRegistry.ts
src/agent/definitions.ts
src/agent/loaders/builtInAgents.ts
```

## 3. Agent 调度层

调度层负责回答：

```text
应该调用哪个 agent？
参数是否合法？
这个 agent 是否存在？
是否允许后台运行？
是否允许使用指定工具？
```

第一阶段可以通过一个 LangChain tool 实现：

```text
delegate_task
```

后续如果系统变复杂，可以升级成更完整的 `AgentTool`。

## 4. Agent 执行层

执行层是真正的 Runtime。

职责：

```text
创建 agentId
创建 ExecutionContext
解析模型
解析 system prompt
解析工具列表
调用底层模型执行器
收集最终结果
记录 transcript
```

建议模块：

```text
src/agent/AgentRuntime.ts
src/agent/ExecutionContext.ts
src/agent/ToolResolver.ts
```

## 5. 模型与工具循环层

这一层复用现有 LangChain 能力。

当前项目里最接近的是：

```text
src/model/Model.ts
```

现在它直接固定创建一个 agent：

```text
new ChatOpenAI()
createAgent({ model, tools, checkpointer })
invoke(input, threadId)
```

后续应改造成：

```text
ModelRunner.invoke({
  input,
  threadId,
  systemPrompt,
  tools,
  checkpointer,
})
```

这样主 agent 和子 agent 都可以复用同一套执行机制。

## 6. 生命周期层

生命周期层处理运行后的状态：

```text
memory
transcript
background task
output file
progress
abort
notification
```

第一阶段可以只做 transcript 的轻量记录，后台任务先不实现。

## 推荐目录结构

第一阶段可以新增：

```text
src/agent/
  AgentDefinition.ts
  AgentRegistry.ts
  AgentRuntime.ts
  ExecutionContext.ts
  ToolResolver.ts
  builtInAgents.ts

src/tools/agent/
  delegateTask.ts
```

后续可演进为：

```text
src/agent/loaders/
  loadMarkdownAgents.ts
  loadPluginAgents.ts

src/agent/tasks/
  TaskManager.ts
  AgentTask.ts

src/agent/transcript/
  TranscriptRecorder.ts
```

## 模块之间的依赖方向

依赖方向应尽量保持单向：

```text
CLI
 -> AgentRuntime
 -> ModelRunner
 -> LangChain

delegate_task
 -> AgentRegistry
 -> AgentRuntime
 -> ModelRunner

AgentDefinition
 <- AgentRegistry
 <- AgentRuntime
```

避免：

```text
Model 直接依赖 CLI
Tool 直接依赖 UI
AgentDefinition 持有 Runtime 实例
Registry 直接执行模型调用
```

## 当前项目的改造重点

当前代码的主要问题不是功能少，而是几个概念还混在一起：

```text
Model 同时负责模型配置、agent 创建、工具注入、memory 注入
AgentManage 只是存 Model 实例，还不是定义驱动的 Registry
工具列表是全量注入，暂时没有 per-agent 权限裁剪
CLI 直接调用 active agent model.invoke()
```

后续应该拆成：

```text
ModelRunner：只负责模型调用
AgentDefinition：只描述 agent
AgentRegistry：只负责查找 agent
AgentRuntime：只负责执行 agent
ToolResolver：只负责给 agent 分配工具
```

