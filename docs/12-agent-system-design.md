# Agent 系统设计说明

本文档说明 HaJiMiCode 中 agent 系统的整体设计、核心模块、执行链路和扩展方式。这里的 agent 不是一个单独的类，而是一套围绕“可配置子会话”的系统：通过 agent 定义描述能力，通过 `AgentTool` 调度，通过 `runAgent()` 构造独立执行上下文，最后复用主 `query()` 循环完成模型调用和工具执行。

## 1. 总体架构

Agent 系统可以分为五层：

```text
Agent 定义层
  built-in agents / markdown agents / plugin agents
        |
        v
AgentTool 调度层
  选择 agent、校验权限、决定同步/后台/隔离/team 路径
        |
        v
runAgent 执行层
  构造子 ToolUseContext、system prompt、tools、MCP、hooks、skills
        |
        v
query 主循环
  复用主会话的模型调用、消息流、工具执行机制
        |
        v
Task 生命周期层
  后台 agent 注册、进度更新、完成通知、停止和输出文件
```

核心代码位置：

| 模块 | 路径 | 作用 |
| --- | --- | --- |
| Agent 类型和加载 | `src/tools/AgentTool/loadAgentsDir.ts` | 定义 `AgentDefinition`，加载内置、用户、项目、策略和插件 agent |
| Agent 工具入口 | `src/tools/AgentTool/AgentTool.tsx` | 模型可调用的 `Agent` 工具，负责 agent 调度 |
| Agent 执行器 | `src/tools/AgentTool/runAgent.ts` | 构造子 agent 执行上下文并调用 `query()` |
| 后台任务状态 | `src/tasks/LocalAgentTask/LocalAgentTask.tsx` | 管理后台 agent 生命周期、进度和通知 |
| Agent 上下文 | `src/utils/agentContext.ts` | 用 `AsyncLocalStorage` 隔离并发 agent 的身份上下文 |
| 插件 agent 加载 | `src/utils/plugins/loadPluginAgents.ts` | 从插件目录加载 agent，并处理命名空间和安全边界 |
| `/agents` 管理 UI | `src/components/agents/` | 创建、编辑、查看、删除 agent 定义文件 |

## 2. Agent 定义模型

Agent 的核心类型是 `AgentDefinition`，包含三类来源：

```text
AgentDefinition
  | BuiltInAgentDefinition
  | CustomAgentDefinition
  | PluginAgentDefinition
```

公共字段主要包括：

| 字段 | 含义 |
| --- | --- |
| `agentType` | agent 类型名，也是调用时的 `subagent_type` |
| `whenToUse` | 描述什么时候使用该 agent，会进入 Agent 工具提示 |
| `tools` | 允许使用的工具列表；省略通常表示继承/全部可用 |
| `disallowedTools` | 禁用工具列表 |
| `model` | agent 模型配置，可使用 `inherit` |
| `effort` | agent 推理努力等级 |
| `permissionMode` | agent 内部工具权限模式 |
| `mcpServers` | agent 专属 MCP server |
| `hooks` | agent 生命周期内注册的 hooks |
| `skills` | agent 启动时预加载的 skills |
| `memory` | agent 记忆范围：`user`、`project`、`local` |
| `background` | 是否强制后台运行 |
| `isolation` | 是否启用隔离，当前主要是 `worktree` |
| `maxTurns` | 最大 agentic turn 数 |

### 2.1 Markdown agent

用户和项目自定义 agent 使用 markdown 文件表示。典型格式如下：

```markdown
---
name: code-reviewer
description: "用于审查代码变更、发现风险和缺失测试"
tools: Read, Grep, Glob, Bash
model: inherit
permissionMode: acceptEdits
memory: project
background: false
---

你是一个专注于代码审查的 agent。

优先输出 bug、风险、回归和缺失测试。
```

文件位置由 `src/components/agents/agentFileUtils.ts` 管理：

| 来源 | 目录 |
| --- | --- |
| 用户级 | `$CLAUDE_CONFIG_HOME/agents` |
| 项目级 | `<cwd>/.claude/agents` |
| 策略级 | managed settings 下的 `.claude/agents` |

### 2.2 内置 agent

内置 agent 由代码提供，通常拥有动态 system prompt：

```ts
type BuiltInAgentDefinition = BaseAgentDefinition & {
  source: 'built-in'
  baseDir: 'built-in'
  getSystemPrompt: (params: {
    toolUseContext: Pick<ToolUseContext, 'options'>
  }) => string
}
```

内置 agent 不落盘，不能通过 `/agents` 直接保存或删除。

### 2.3 插件 agent

插件 agent 从插件目录加载，逻辑在 `src/utils/plugins/loadPluginAgents.ts`。插件 agent 会自动加命名空间：

```text
pluginName[:namespace]:agentName
```

例如插件 `github` 中的 `reviewer.md` 会变成：

```text
github:reviewer
```

插件 agent 的安全边界更严格。代码中明确忽略插件 agent 文件里的部分高权限字段，例如：

```text
permissionMode
hooks
mcpServers
```

原因是插件是第三方分发物，不能让某个隐藏在插件目录里的 agent 文件静默扩大权限。如果确实需要这些能力，应由用户在 `.claude/agents/` 中显式定义。

## 3. Agent 加载和覆盖规则

入口是 `getAgentDefinitionsWithOverrides(cwd)`。

加载顺序大致是：

```text
1. 内置 agents
2. 插件 agents
3. 用户/项目/策略/flag agents
4. 合并并计算 activeAgents
5. 初始化颜色和可选 memory snapshot
```

同名 agent 的覆盖逻辑由 `getActiveAgentsFromList()` 控制。代码会按分组写入 `Map`，后写入者覆盖前写入者。当前优先级大致是：

```text
built-in
plugin
userSettings
projectSettings
flagSettings
policySettings
```

因此更靠后的来源可以覆盖更靠前的同名 agent。

如果加载自定义 agent 出错，系统会记录 `failedFiles`，但仍回退到内置 agents，避免整个会话不可用。

## 4. AgentTool 调度流程

`AgentTool` 是模型实际看到并调用的工具，定义在：

```text
src/tools/AgentTool/AgentTool.tsx
```

输入 schema 包括：

| 参数 | 作用 |
| --- | --- |
| `description` | 任务短描述 |
| `prompt` | 发给 agent 的完整任务 |
| `subagent_type` | 指定使用哪个 agent |
| `model` | 本次调用的模型覆盖 |
| `run_in_background` | 是否后台运行 |
| `name` | team/swarm 模式下的 agent 名称 |
| `team_name` | team/swarm 模式下的团队名 |
| `mode` | team/swarm 子 agent 的权限模式 |
| `isolation` | 隔离模式，如 `worktree` |
| `cwd` | 覆盖 agent 工作目录 |

调用流程：

```text
AgentTool.call()
  |
  |-- 读取 AppState 和当前权限上下文
  |-- 检查 team/swarm 参数
  |-- 如果 team_name + name 存在，走 spawnTeammate()
  |-- 解析 effectiveType
  |-- 从 activeAgents 查找 selectedAgent
  |-- 检查 permission deny rules
  |-- 检查 requiredMcpServers
  |-- 解析 model、prompt、system prompt
  |-- 判断 shouldRunAsync
  |-- 组装 worker tool pool
  |-- 可选创建 worktree
  |-- 调用 runAgent()
```

## 5. 同步 agent 与后台 agent

AgentTool 支持两种运行方式。

### 5.1 同步 agent

同步 agent 会阻塞当前工具调用，直到 agent 完成。它适合短任务，例如：

```text
搜索代码
分析某个模块
生成简短建议
```

同步路径中，AgentTool 会：

```text
1. 创建 syncAgentId
2. 注册 foreground task，允许运行中切后台
3. 调用 runAgent()
4. 收集 agent 消息和最终结果
5. 返回 completed 结果
```

同步 agent 共享父会话的 abort controller，因此用户取消当前 turn 时，同步 agent 也会被取消。

### 5.2 后台 agent

后台 agent 由 `LocalAgentTask` 管理，适合长任务：

```text
大规模搜索
复杂重构分析
长时间验证
coordinator 模式下的并行任务
```

后台运行触发条件包括：

```text
run_in_background === true
selectedAgent.background === true
coordinator mode
fork subagent gate
assistant/kairos/proactive 模式
```

后台路径中，AgentTool 会：

```text
1. 提前创建 agentId
2. registerAsyncAgent()
3. 返回 async_launched
4. detached 执行 runAsyncAgentLifecycle()
5. 后台完成后 enqueueAgentNotification()
```

返回给调用方的数据包含：

```json
{
  "status": "async_launched",
  "agentId": "...",
  "description": "...",
  "prompt": "...",
  "outputFile": "...",
  "canReadOutputFile": true
}
```

后台 agent 完成后，会向主会话注入类似：

```xml
<task-notification>
  <task-id>...</task-id>
  <output-file>...</output-file>
  <status>completed</status>
  <summary>Agent "..." completed</summary>
  <result>...</result>
</task-notification>
```

这样主 agent 可以在后续 turn 中自然读取后台结果。

## 6. runAgent 执行上下文

`runAgent()` 是普通 subagent 的核心执行器。它并不重新实现模型 loop，而是创建一个子 `ToolUseContext`，然后复用 `query()`。

主要职责：

```text
1. 解析 agent 模型
2. 创建 agentId
3. 准备初始 messages
4. 构造 userContext/systemContext
5. 应用 permissionMode 和 effort
6. 解析 agent tools
7. 构造 agent system prompt
8. 执行 SubagentStart hooks
9. 注册 frontmatter hooks
10. 预加载 skills
11. 初始化 agent-specific MCP servers
12. 创建子 ToolUseContext
13. 记录 sidechain transcript
14. 调用 query()
```

关键设计是 `createSubagentContext()`：

```text
父 ToolUseContext
  |
  v
子 ToolUseContext
  - 独立 messages
  - 独立 tools
  - 独立 mcpClients
  - 独立 readFileState
  - 可选共享 setAppState
  - 可选共享 setResponseLength
  - agentId / agentType
```

同步 agent 通常共享父会话的部分能力；后台 agent 更独立，并设置 `isNonInteractiveSession`，避免后台任务弹出交互式权限提示。

## 7. 工具权限设计

Agent 的工具集由三部分共同决定：

```text
可用工具池 availableTools
  + agent.tools 白名单
  - agent.disallowedTools 黑名单
  + agent-specific MCP tools
```

`AgentTool.tsx` 中会先根据当前 AppState 组装 worker tool pool：

```text
assembleToolPool(workerPermissionContext, appState.mcp.tools)
```

然后 `runAgent.ts` 中通过 `resolveAgentTools()` 得到最终工具列表。

权限模式也会在 agent 内部重新计算：

```text
agentDefinition.permissionMode
  |
  v
agentGetAppState()
  |
  v
子 agent 看到的 toolPermissionContext
```

但父会话如果已经处在更高权限模式，例如 `bypassPermissions`、`acceptEdits` 或 auto 模式，agent 不会随意降级/覆盖父级语义。

后台 agent 默认避免权限弹窗：

```text
shouldAvoidPermissionPrompts = true
```

除非使用 bubble 模式或显式允许展示权限提示。

## 8. MCP 设计

Agent 支持两类 MCP server：

```text
1. 引用已有 MCP server
   mcpServers: ["slack"]

2. inline 定义 agent 专属 MCP server
   mcpServers:
     - my-server:
         command: ...
```

`runAgent()` 会调用 `initializeAgentMcpServers()`：

```text
agentDefinition.mcpServers
  |
  v
connectToServer()
  |
  v
fetchToolsForClient()
  |
  v
merge resolvedTools + agentMcpTools
```

inline MCP server 在 agent 结束后会清理；引用已有 server 则复用父上下文或全局 memoized 连接，不由单个 agent 清理。

插件 agent 默认不解析 per-agent `mcpServers`，以避免插件文件静默扩大能力边界。

## 9. Hooks 和 Skills

Agent 启动时会执行：

```text
SubagentStart hooks
```

这些 hook 可以返回 additional context，系统会把它们作为 attachment message 加到 agent 初始消息中。

Agent frontmatter 也可以声明 hooks：

```yaml
hooks:
  Stop:
    - matcher: ...
      hooks:
        - type: command
          command: ...
```

在 agent 内部注册时，Stop 类 hook 会转换为 subagent 生命周期语义。

Agent 还可以声明预加载 skills：

```yaml
skills:
  - verify
  - plugin-name:skill-name
```

`runAgent()` 会解析 skill 名称，加载 prompt-based skill 的内容，并作为 meta user message 注入初始上下文。

## 10. Memory 设计

Agent 支持持久记忆范围：

```text
user
project
local
```

当 `memory` 启用时，系统会：

```text
1. 在 getSystemPrompt() 后拼接 memory prompt
2. 自动确保 Read/Write/Edit 等记忆访问工具可用
3. 可选初始化 memory snapshot
```

相关逻辑分布在：

```text
src/tools/AgentTool/agentMemory.ts
src/tools/AgentTool/agentMemorySnapshot.ts
src/tools/AgentTool/loadAgentsDir.ts
src/utils/plugins/loadPluginAgents.ts
```

## 11. Worktree 隔离

Agent 可以通过 `isolation: worktree` 在独立 git worktree 中运行。

触发方式：

```yaml
---
name: isolated-worker
description: "在隔离工作树中尝试修改"
isolation: worktree
---
```

或调用 `AgentTool` 时传入：

```json
{
  "isolation": "worktree"
}
```

执行流程：

```text
1. AgentTool 提前创建 agentId
2. 使用 agentId 生成 worktree slug
3. createAgentWorktree()
4. runWithCwdOverride(worktreePath, ...)
5. agent 完成后检查 worktree 是否有变更
6. 无变更则删除，有变更则保留并在通知中带出路径
```

这让 agent 可以尝试修改而不直接污染主工作区。

## 12. Team / Swarm Agent

普通 subagent 和 team/swarm agent 是两条不同路径。

当 `AgentTool` 收到：

```text
team_name + name
```

会调用：

```text
spawnTeammate()
```

返回状态是：

```text
teammate_spawned
```

这类 teammate 可能运行在 tmux/split pane 或 in-process 环境中，并通过 team context 互相通信。普通 subagent 的上下文类型是：

```text
agentType: 'subagent'
```

teammate 的上下文类型是：

```text
agentType: 'teammate'
```

两者统一通过 `src/utils/agentContext.ts` 中的 `AsyncLocalStorage` 做身份隔离。

## 13. 并发上下文隔离

后台 agent 可以并发运行。如果只把当前 agent 信息存在全局 AppState 中，就会出现：

```text
Agent A 的 telemetry 误记成 Agent B
Agent B 的 resume 边界覆盖 Agent A
父子关系错乱
```

因此系统使用：

```ts
const agentContextStorage = new AsyncLocalStorage<AgentContext>()
```

并通过：

```ts
runWithAgentContext(context, fn)
```

把 agent 身份绑定到当前 async execution chain。

这可以保证多个后台 agent 在同一个进程中并发运行时，analytics、session 关系、invocation 边界互不污染。

## 14. Transcript 和输出

Agent 的消息会记录到 sidechain transcript：

```text
recordSidechainTranscript(...)
writeAgentMetadata(...)
```

后台任务还会初始化 output file symlink：

```text
initTaskOutputAsSymlink(agentId, getAgentTranscriptPath(agentId))
```

因此主 agent 或用户可以通过 task output 路径查看后台 agent 进展和最终结果。

## 15. 创建一个新 agent 的推荐方式

最简单方式是在项目中添加：

```text
.claude/agents/<agent-name>.md
```

示例：

```markdown
---
name: file-read-debugger
description: "用于分析 FileReadTool 相关读取、限制、图片处理和 UI 展示问题"
tools: Read, Grep, Glob, Bash
model: inherit
memory: project
---

你专门分析 FileReadTool 相关代码。

关注：
- 文件读取入口和参数校验
- limits 限制逻辑
- imageProcessor 图片处理逻辑
- UI 展示和 tool result 渲染
- 权限、错误处理和边界情况

输出时优先给出文件路径、关键函数和可能的测试点。
```

然后在对话中可由模型通过 Agent 工具调用：

```json
{
  "description": "分析读取限制",
  "prompt": "检查 FileReadTool 的读取限制和错误处理是否一致",
  "subagent_type": "file-read-debugger"
}
```

## 16. 设计取舍

### 复用主 query loop

Agent 不重新实现模型循环，而是通过 `runAgent()` 创建子上下文后复用 `query()`。这样工具执行、消息流、权限、token 统计、错误处理和 transcript 逻辑都能保持一致。

### 定义和执行分离

Agent definition 只描述能力和提示词，不直接执行。执行细节集中在 `AgentTool` 和 `runAgent()`，便于统一处理权限、MCP、hooks、后台任务和隔离模式。

### 后台任务统一托管

后台 agent 不由 AgentTool 私有管理，而是接入 `Task` 框架。这样 UI、停止、进度、通知、输出文件都能和其他后台任务保持一致。

### 插件安全边界

插件 agent 可以提供 prompt、tools、memory、model 等能力，但不能在单个 agent 文件里静默声明高权限字段。高权限配置需要用户或管理员显式批准。

### AsyncLocalStorage 隔离并发身份

agent 身份跟随 async call chain，而不是存在单一全局状态里。这是后台并发 agent 能正确归因的关键。

## 17. 排查入口

如果 agent 没有出现：

```text
1. 检查 markdown frontmatter 是否有 name 和 description
2. 检查是否被同名 agent 覆盖
3. 检查 requiredMcpServers 是否满足
4. 检查 permission deny rules
5. 检查插件是否启用
```

如果 agent 工具不可用：

```text
1. 检查 tools/disallowedTools 配置
2. 检查当前 permissionMode
3. 检查后台 agent 是否避免权限弹窗
4. 检查 MCP server 是否连接且暴露 tools
```

如果后台 agent 无结果：

```text
1. 查看 LocalAgentTask 状态
2. 查看 outputFile
3. 查看 sidechain transcript
4. 检查是否被 kill 或 abort
5. 检查 task-notification 是否已入队
```

## 18. 简化序列图

```text
模型
  |
  | AgentTool.call({ subagent_type, prompt })
  v
AgentTool
  |
  | 选择 selectedAgent
  | 校验权限/MCP/隔离/后台
  v
runAgent
  |
  | 创建子 ToolUseContext
  | 构造 system prompt + tools + hooks + MCP
  v
query()
  |
  | 模型调用和工具执行
  v
Agent 消息流
  |
  | 同步：直接返回 completed
  | 后台：写入 LocalAgentTask 并发送 task-notification
  v
主会话
```

