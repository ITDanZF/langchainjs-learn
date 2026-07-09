# 09. 实施路线图

这份路线图用于把 Agent Runtime 从当前项目中逐步实现出来。

## 当前状态

当前项目已有：

```text
Model.ts
  创建 ChatOpenAI
  创建 LangChain createAgent
  注入全部 tools
  使用 Memory checkpointer
  提供 invoke(input, threadId)

tools/
  read_file
  write_file
  edit_file
  list_files
  search_text

Memory/
  sqlite/json checkpointer

CLI
  接收用户输入
  调用 active agent
```

当前缺少：

```text
AgentDefinition
AgentRegistry
AgentRuntime
ExecutionContext
ToolResolver
delegate_task
per-agent tools
transcript
```

## 阶段 1：最小 Agent Runtime

目标：

```text
能定义多个内置 agent
能按定义裁剪工具
能通过 Runtime 运行指定 agent
```

新增文件：

```text
src/agent/AgentDefinition.ts
src/agent/builtInAgents.ts
src/agent/AgentRegistry.ts
src/agent/ToolResolver.ts
src/agent/ExecutionContext.ts
src/agent/AgentRuntime.ts
```

验收标准：

```text
registry.list() 能看到 code-reviewer / code-searcher / file-editor
ToolResolver 能让 code-reviewer 只拿到读工具
AgentRuntime.run({ subagentType, prompt }) 能返回结果
```

## 阶段 2：ModelRunner 改造

目标：

```text
Model 不再固定绑定一组 tools 和 system prompt
每次 invoke 可传入 systemPrompt 和 tools
```

改造方向：

```text
Model -> ModelRunner
constructor 只初始化 ChatOpenAI 和 Memory
invoke() 接收 systemPrompt/tools/threadId
```

验收标准：

```text
主 agent 可以使用 baseSystemPrompt
子 agent 可以使用自己的 systemPrompt
不同 agent 可以拿到不同工具列表
```

## 阶段 3：delegate_task 工具

目标：

```text
主 agent 能调用子 agent
```

新增：

```text
src/tools/agent/delegateTask.ts
```

并在主 agent tools 中加入：

```text
delegate_task
```

验收标准：

```text
用户要求“请让 reviewer 检查 edit_file”
主 agent 调用 delegate_task
code-reviewer 子 agent 运行
结果返回给主 agent
```

## 阶段 4：CLI 支持 agent 查看

目标：

```text
用户可以查看当前有哪些 agent
```

新增命令：

```text
/agents
/agents show <id>
```

验收标准：

```text
/agents 显示 id、name、description、tools
/agents show code-reviewer 显示 systemPrompt 和详细配置
```

## 阶段 5：项目级 markdown agent

目标：

```text
项目可以通过 .agents/*.md 定义 agent
```

新增：

```text
src/agent/loaders/loadMarkdownAgents.ts
```

目录：

```text
mini-agent-langchain/.agents/
```

验收标准：

```text
新增 .agents/tester.md 后，/agents 能看到 tester
同名项目 agent 可以覆盖 built-in agent
frontmatter 错误不会导致程序崩溃
```

## 阶段 6：Transcript

目标：

```text
每次 agent 运行都有可追踪记录
```

新增：

```text
src/agent/transcript/TranscriptRecorder.ts
```

目录：

```text
.agent-runtime/transcripts/
```

验收标准：

```text
每次 delegate_task 生成一个 transcript json
包含 agentId、subagentType、prompt、tools、result、error
```

## 阶段 7：后台 Task

目标：

```text
长任务可后台运行
```

新增：

```text
src/agent/tasks/TaskManager.ts
src/agent/tasks/AgentTask.ts
```

验收标准：

```text
delegate_task 支持 run_in_background
立即返回 taskId
后台完成后可通过命令查看结果
```

## 阶段 8：上下文隔离升级

目标：

```text
并发 agent 的身份、工具权限、readFileState 不串
```

新增：

```text
src/agent/ExecutionContextStorage.ts
```

使用：

```text
AsyncLocalStorage<ExecutionContext>
```

验收标准：

```text
两个后台 agent 同时运行时 transcript 不混
工具内部能读取当前 agentId
readFileState 可以按 agent 隔离
```

## 建议第一轮只做到阶段 3

第一轮实现范围：

```text
AgentDefinition
AgentRegistry
ToolResolver
AgentRuntime
ModelRunner invoke 参数化
delegate_task
```

不要第一轮就做：

```text
markdown loader
background task
AsyncLocalStorage
worktree
plugin
MCP
```

## 第一轮完成后的价值

完成阶段 1 到阶段 3 后，项目就具备真正的 Agent Runtime 雏形：

```text
主 agent 可以调度子 agent
子 agent 有自己的 prompt
子 agent 有自己的工具权限
底层复用同一套 LangChain 执行机制
后续可以嵌入其他智能体项目
```

这就是本工程最核心的价值起点。

