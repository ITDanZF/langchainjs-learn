# Node.js 端 Agent 学习路线图

> 目标：从 Node.js 工程视角理解并实现一个可用的 LLM Agent。  
> 适合对象：已经会基本 JavaScript/TypeScript，希望学习工具调用、工作流、记忆、CLI/TUI agent 或 coding agent 的开发者。

## 1. 先建立正确认知

学习 Agent 前，先明确一个原则：

**Agent 不是“一个很长的 prompt”，而是 LLM、工具、状态、反馈循环和安全边界组成的系统。**

建议先阅读本项目已有两份资料：

- [LLM 驱动的自主智能体](./llm-powered-autonomous-agents-cn.md)
- [构建有效的 AI Agent](./building-effective-agents-cn.md)

读完后需要掌握这些概念：

- LLM 作为推理和控制中心。
- Planning：任务拆解、计划、反思。
- Memory：短期上下文、长期记忆、向量检索。
- Tool Use：工具定义、参数校验、执行结果反馈。
- Workflow vs Agent：固定流程和自主循环的区别。
- Guardrails：权限、安全、停止条件和人工确认。

## 2. 学习前置技能

### 2.1 Node.js 基础

需要熟悉：

- ESM / CommonJS 模块系统。
- `async` / `await`。
- `fetch` / HTTP 请求。
- 文件系统 `fs/promises`。
- 子进程 `child_process`。
- 流式输出 `ReadableStream`。
- 环境变量和配置文件。

练习目标：

- 写一个 Node.js CLI，读取用户输入并输出结果。
- 调用一个 HTTP API。
- 读取和写入本地文件。
- 执行一个 shell 命令并捕获 stdout/stderr。

### 2.2 TypeScript

Agent 系统强烈建议使用 TypeScript，因为工具调用、状态机和消息协议都需要清晰类型。

需要熟悉：

- interface / type。
- discriminated union。
- generic。
- `zod` 或类似 schema 校验库。
- `ts-node` / `tsx` / 构建配置。

练习目标：

- 用 TypeScript 定义消息类型：user、assistant、tool_call、tool_result。
- 用 `zod` 校验工具参数。

### 2.3 CLI / TUI 基础

如果目标是学习 Claude Code、Codex CLI 这类项目，需要理解终端交互。

推荐了解：

- CLI 参数解析：`commander`、`yargs`、`cac`。
- 交互输入：`readline`、`prompts`、`inquirer`。
- TUI 渲染：`ink`、`blessed`、`react-blessed`。
- 日志和状态展示。

练习目标：

- 做一个简单命令：`agent "帮我总结 README"`。
- 做一个 REPL：用户输入问题，模型连续回答。
- 显示工具调用状态，例如 `Reading file...`、`Running tests...`。

## 3. 第一个最小 Agent

### 3.1 目标

先实现一个最小可运行循环：

```text
用户输入
  ↓
发送给 LLM
  ↓
LLM 输出回答
  ↓
显示给用户
```

暂时不要加工具、记忆和复杂规划。

### 3.2 你需要实现

目录建议：

```text
agent-demo/
  package.json
  src/
    index.ts
    llm.ts
    types.ts
```

核心模块：

- `index.ts`：CLI 入口。
- `llm.ts`：封装模型调用。
- `types.ts`：定义消息结构。

### 3.3 验收标准

- 可以从命令行启动。
- 可以输入一段问题。
- 可以拿到模型回答。
- 模型调用封装在独立模块里，而不是散落在业务代码中。

## 4. 加入工具调用

Agent 的关键能力是工具使用。Node.js 端最常见的工具包括：

- 读取文件。
- 写入文件。
- 搜索文件。
- 执行 shell 命令。
- HTTP 请求。
- 查询数据库。

### 4.1 工具抽象

建议定义统一工具接口：

```ts
type Tool<Input, Output> = {
  name: string;
  description: string;
  schema: unknown;
  execute(input: Input): Promise<Output>;
};
```

工具需要包含：

- 名称。
- 描述。
- 参数 schema。
- 执行函数。
- 错误处理。
- 权限等级。

### 4.2 推荐先实现的工具

第一批工具：

1. `read_file`：读取指定文件。
2. `list_files`：列出目录文件。
3. `search_text`：搜索文本。
4. `run_command`：执行只读命令。

注意：不要一开始就允许任意写文件或执行危险命令。

### 4.3 工具调用循环

基本流程：

```text
用户输入
  ↓
LLM 判断是否需要工具
  ↓
如果需要工具：输出 tool_call
  ↓
Node.js 执行工具
  ↓
把 tool_result 放回上下文
  ↓
LLM 继续回答或继续调用工具
```

### 4.4 验收标准

- 模型可以要求读取文件。
- Node.js 能执行工具并返回结果。
- 工具参数经过 schema 校验。
- 工具错误会以结构化结果返回给模型。

## 5. 加入状态和消息历史

没有状态，Agent 只能一次性回答；有状态后，它才能进行多步任务。

### 5.1 需要保存的状态

建议保存：

- 用户原始目标。
- 消息历史。
- 已执行工具调用。
- 当前计划。
- 任务状态：running、waiting_approval、failed、done。
- token 使用量或调用成本。

### 5.2 消息结构建议

```ts
type AgentMessage =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool_call"; toolName: string; input: unknown }
  | { role: "tool_result"; toolName: string; output: unknown; isError?: boolean };
```

### 5.3 上下文裁剪

随着工具调用增多，上下文会越来越长。需要设计：

- 最近消息保留。
- 旧消息摘要。
- 大文件内容截断。
- 工具输出大小限制。
- 重要信息 pin 到系统上下文。

### 5.4 验收标准

- Agent 可以完成两步以上任务。
- 能看到完整工具调用历史。
- 长输出不会直接塞爆上下文。

## 6. 从 Workflow 学起

不要一开始就做完全自主 Agent。先实现几个稳定工作流。

### 6.1 Prompt Chaining

示例：生成技术文档。

```text
用户需求
  ↓
生成大纲
  ↓
检查大纲
  ↓
生成正文
  ↓
润色和格式化
```

学习重点：

- 每一步 prompt 只做一件事。
- 中间结果可检查。
- 失败时可重试。

### 6.2 Routing

示例：根据任务类型路由。

```text
输入
  ↓
分类：问答 / 代码修改 / 文档整理 / 命令执行
  ↓
进入不同处理器
```

学习重点：

- 分类结果必须结构化。
- 每个路径有自己的 prompt 和工具权限。

### 6.3 Evaluator-Optimizer

示例：代码修改。

```text
生成修改
  ↓
运行测试
  ↓
根据失败信息修复
  ↓
直到通过或达到最大次数
```

学习重点：

- 建立反馈循环。
- 定义最大迭代次数。
- 明确停止条件。

## 7. 再做自主 Agent 循环

当工具、状态和工作流都稳定后，再做自主 Agent。

### 7.1 核心循环

```text
while not done:
  1. 让 LLM 观察当前状态
  2. 让 LLM 决定下一步
  3. 如果下一步是工具调用，执行工具
  4. 如果下一步是最终回答，结束
  5. 如果下一步需要用户确认，暂停
```

### 7.2 行动类型

建议让模型只能输出有限几种 action：

```ts
type AgentAction =
  | { type: "respond"; content: string }
  | { type: "call_tool"; toolName: string; input: unknown }
  | { type: "ask_user"; question: string }
  | { type: "update_plan"; plan: string[] }
  | { type: "finish"; summary: string };
```

不要让模型随意输出自然语言再靠正则解析。尽量使用结构化输出。

### 7.3 停止条件

必须设计停止条件：

- 达成目标。
- 达到最大轮数。
- 连续工具失败。
- 成本超过上限。
- 命令需要用户批准。
- 模型无法判断下一步。

### 7.4 验收标准

- Agent 可以自己选择工具。
- Agent 可以根据工具结果调整下一步。
- Agent 不会无限循环。
- 高风险动作会等待用户确认。

## 8. 加入记忆

记忆分两类：短期记忆和长期记忆。

### 8.1 短期记忆

短期记忆就是当前任务上下文：

- 用户目标。
- 最近消息。
- 工具结果。
- 当前计划。

实现重点：

- 控制上下文长度。
- 摘要旧历史。
- 保留关键事实。

### 8.2 长期记忆

长期记忆可以先从简单 JSON 文件开始，不必一上来就用向量数据库。

阶段路线：

1. JSON 文件存储用户偏好。
2. SQLite 存储任务历史。
3. Embedding + 向量检索。
4. 加入记忆更新和遗忘策略。

### 8.3 验收标准

- Agent 能记住用户偏好。
- Agent 能复用历史任务经验。
- 记忆可查看、可删除、可更新。

## 9. 安全和权限模型

Node.js Agent 很容易接触文件系统和 shell，必须认真设计安全边界。

### 9.1 工具权限等级

建议分级：

| 等级 | 例子 | 是否需要确认 |
| --- | --- | --- |
| read | 读文件、列目录、搜索文本 | 通常不需要 |
| write | 写文件、修改配置 | 需要确认或限制目录 |
| execute-safe | 运行测试、格式化、lint | 视项目策略 |
| execute-risky | 安装依赖、删除文件、网络发布 | 必须确认 |
| external | 发邮件、提交 PR、调用付费 API | 必须确认 |

### 9.2 文件系统边界

需要限制：

- 只能访问工作区。
- 禁止读取敏感路径。
- 写操作必须检查目标路径。
- 删除操作必须人工确认。

### 9.3 命令执行边界

建议：

- 默认禁止任意 shell。
- 使用 allowlist。
- 高风险命令需要确认。
- 记录每次执行命令。
- 设置超时。
- 捕获 stdout、stderr、exit code。

## 10. 可观测性与调试

Agent 难调试，所以一开始就要记录过程。

需要记录：

- 每次 LLM 请求和响应。
- 工具调用输入输出。
- token 用量。
- 执行耗时。
- 错误堆栈。
- 状态变更。

推荐输出：

```text
[plan] 读取 package.json 确认项目类型
[tool] read_file package.json
[tool-result] 读取成功，长度 1820
[action] 运行 npm test
[error] 测试失败，准备分析 stderr
```

## 11. 推荐项目练习

### 项目 1：文档总结 Agent

能力：

- 读取 Markdown。
- 总结章节。
- 输出中文摘要。

重点：

- 文件读取工具。
- 长文本截断和分段总结。

### 项目 2：仓库问答 Agent

能力：

- 搜索代码。
- 读取相关文件。
- 回答“这个函数在哪里用到”。

重点：

- `search_text`。
- 上下文选择。
- 引用文件路径。

### 项目 3：测试修复 Agent

能力：

- 运行测试。
- 分析失败。
- 修改代码。
- 再次运行测试。

重点：

- evaluator-optimizer。
- 文件写入权限。
- 最大迭代次数。

### 项目 4：终端 TUI Agent

能力：

- 展示对话。
- 展示工具调用状态。
- 支持确认操作。
- 支持中断任务。

重点：

- TUI 状态管理。
- 流式输出。
- 用户审批。

### 项目 5：Mini Claude Code

能力：

- 接收自然语言 coding 任务。
- 搜索代码。
- 制定计划。
- 修改文件。
- 运行测试。
- 输出总结。

重点：

- 完整 agent loop。
- 安全边界。
- 计划与执行可视化。

## 12. 推荐学习顺序

### 第 1 阶段：基础 API 和 CLI

目标：

- 能在 Node.js 中调用 LLM。
- 能做一个最小 CLI。

产出：

- `ask` 命令：输入问题，输出回答。

### 第 2 阶段：工具调用

目标：

- 实现工具注册和执行。
- 支持读文件、列目录、搜索文本。

产出：

- `repo-qa`：能回答代码仓库问题。

### 第 3 阶段：工作流

目标：

- 实现 prompt chaining、routing、evaluator-optimizer。

产出：

- `doc-agent`：能整理文档。
- `test-fix-agent`：能根据测试失败迭代修复。

### 第 4 阶段：自主循环

目标：

- 实现 observe-think-act 循环。
- 支持计划、工具、停止条件。

产出：

- `mini-agent`：可以完成多步开放任务。

### 第 5 阶段：TUI 和工程化

目标：

- 做出可交互终端界面。
- 加入权限、日志、配置和会话管理。

产出：

- `mini-claude-code`：一个小型 coding agent。

## 13. 技术选型建议

### 13.1 基础栈

推荐：

- Node.js 20+
- TypeScript
- `tsx`
- `zod`
- `commander` 或 `cac`
- `prompts` 或 `inquirer`
- `execa`
- `fast-glob`

### 13.2 TUI 栈

可选：

- `ink`：React 风格，适合现代 TUI。
- `blessed`：更底层，适合复杂终端布局。

### 13.3 存储

阶段式选择：

- JSON 文件：配置和简单记忆。
- SQLite：任务历史和会话。
- 向量数据库：语义记忆和代码检索。

### 13.4 模型接口

建议自己先封装一层 `LLMClient`，不要让业务逻辑直接依赖某个 SDK。

```ts
interface LLMClient {
  complete(input: LLMRequest): Promise<LLMResponse>;
  stream?(input: LLMRequest): AsyncIterable<LLMChunk>;
}
```

这样后续可以切换不同模型提供商。

## 14. 最小架构图

```text
CLI / TUI
  ↓
Agent Runtime
  ├─ LLM Client
  ├─ Tool Registry
  ├─ State Store
  ├─ Permission Manager
  └─ Logger
  ↓
Workspace / Shell / APIs / Memory
```

## 15. 代码目录建议

```text
src/
  cli/
    index.ts
    commands.ts
  agent/
    runtime.ts
    loop.ts
    planner.ts
    state.ts
    types.ts
  llm/
    client.ts
    providers/
      openai.ts
      anthropic.ts
  tools/
    registry.ts
    read-file.ts
    list-files.ts
    search-text.ts
    run-command.ts
    write-file.ts
  memory/
    short-term.ts
    long-term.ts
    summarize.ts
  permissions/
    policy.ts
    approval.ts
  ui/
    renderer.ts
  logging/
    trace.ts
```

## 16. 常见坑

1. **过早做复杂 Agent**：先做 workflow，再做自主循环。
2. **工具描述太模糊**：模型会误用工具。
3. **没有 schema 校验**：参数错误会越来越多。
4. **没有停止条件**：Agent 容易无限循环。
5. **上下文无限增长**：成本和效果都会变差。
6. **shell 权限太大**：容易造成安全事故。
7. **看不到过程**：无法调试，也无法让用户信任。
8. **只依赖自然语言解析**：输出格式漂移后系统会崩。
9. **没有评估集**：无法判断改动是否真的变好。
10. **忽略失败路径**：工具失败、模型拒答、网络失败都需要处理。

## 17. 学习检查清单

完成下面内容，就算具备 Node.js Agent 基础能力：

- [ ] 能用 Node.js 调用 LLM。
- [ ] 能实现流式输出。
- [ ] 能定义工具 schema。
- [ ] 能执行工具调用并回传结果。
- [ ] 能保存消息历史。
- [ ] 能裁剪上下文。
- [ ] 能实现 prompt chaining。
- [ ] 能实现 routing。
- [ ] 能实现 evaluator-optimizer。
- [ ] 能实现自主 agent loop。
- [ ] 能限制文件系统访问。
- [ ] 能限制 shell 命令。
- [ ] 能记录完整 trace。
- [ ] 能做一个简单 TUI。
- [ ] 能完成一个 mini coding agent。

## 18. 推荐最终作品

最终建议做一个 `Mini Coding Agent`：

用户输入：

```text
帮我修复当前项目里失败的测试
```

Agent 行为：

1. 读取项目结构。
2. 判断项目类型。
3. 运行测试。
4. 分析失败信息。
5. 搜索相关代码。
6. 制定修改计划。
7. 修改文件。
8. 再次运行测试。
9. 输出变更总结和测试结果。

这个项目会逼你覆盖 Node.js agent 的核心能力：LLM 调用、工具系统、状态管理、权限、安全、反馈循环、文件编辑和终端交互。

