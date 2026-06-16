# Node.js Agent 从 0 到 1 系统教程

> 目标：用 Node.js + TypeScript 从零实现一个最小可用的 LLM Agent。  
> 产出：一个可以对话、调用工具、读取项目文件、执行安全命令、记录状态，并能扩展成 coding agent 的基础框架。

## 1. 你要构建的东西

本教程最终会构建一个简化版 Agent Runtime：

```text
用户输入
  ↓
Agent Runtime
  ├─ LLM Client：调用模型
  ├─ Tool Registry：注册和执行工具
  ├─ State Store：保存消息和任务状态
  ├─ Permission Manager：处理高风险操作确认
  └─ Logger：记录执行轨迹
  ↓
文件系统 / Shell / 外部 API
```

它不是完整的 Claude Code 或 Codex，但会覆盖核心机制。

## 2. 学习前准备

### 2.1 需要具备的基础

你需要会：

- JavaScript 基础。
- Node.js 基础。
- `async` / `await`。
- 基本命令行操作。
- TypeScript 基础。

如果还不熟悉 TypeScript，也可以边做边学，因为 Agent 项目非常适合用类型系统约束复杂状态。

### 2.2 推荐环境

推荐：

- Node.js 20 或更高。
- pnpm / npm / yarn 任一包管理器。
- TypeScript。
- 一个 LLM API Key。

本文用 `pnpm` 举例，换成 `npm` 也可以。

## 3. 第一步：初始化项目

创建项目：

```bash
mkdir node-agent-demo
cd node-agent-demo
pnpm init
```

安装依赖：

```bash
pnpm add zod dotenv execa fast-glob
pnpm add -D typescript tsx @types/node
```

初始化 TypeScript：

```bash
pnpm tsc --init
```

建议 `tsconfig.json` 设置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

修改 `package.json`：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

创建目录：

```text
src/
  index.ts
  config.ts
  llm/
    client.ts
  agent/
    runtime.ts
    types.ts
    state.ts
  tools/
    registry.ts
    read-file.ts
    list-files.ts
    search-text.ts
    run-command.ts
  permissions/
    policy.ts
  logging/
    logger.ts
```

## 4. 第二步：配置环境变量

创建 `.env`：

```bash
LLM_API_KEY=your_api_key_here
LLM_MODEL=your_model_name_here
```

创建 `src/config.ts`：

```ts
import "dotenv/config";

export const config = {
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "default-model",
};

if (!config.llmApiKey) {
  console.warn("LLM_API_KEY is not set.");
}
```

说明：

- 不要把 API Key 写死在代码里。
- `.env` 不要提交到 Git。
- 模型提供商可以后续替换，所以我们先封装通用客户端接口。

## 5. 第三步：定义核心类型

创建 `src/agent/types.ts`：

```ts
export type Role = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: Role;
  content: string;
};

export type ToolCall = {
  id: string;
  name: string;
  input: unknown;
};

export type LLMResponse = {
  content: string;
  toolCalls?: ToolCall[];
};

export type AgentStatus =
  | "idle"
  | "running"
  | "waiting_approval"
  | "done"
  | "failed";

export type AgentState = {
  status: AgentStatus;
  messages: ChatMessage[];
  steps: AgentStep[];
};

export type AgentStep =
  | {
      type: "llm";
      inputMessages: ChatMessage[];
      output: LLMResponse;
    }
  | {
      type: "tool";
      toolName: string;
      input: unknown;
      output: unknown;
      isError?: boolean;
    };
```

这些类型构成 Agent 的基础协议。

关键点：

- 消息历史用于给模型上下文。
- `ToolCall` 是模型请求 Node.js 执行工具的结构。
- `AgentStep` 用于调试和追踪执行过程。

## 6. 第四步：封装 LLM Client

创建 `src/llm/client.ts`：

```ts
import type { ChatMessage, LLMResponse } from "../agent/types.js";

export type LLMClient = {
  complete(messages: ChatMessage[]): Promise<LLMResponse>;
};
```

然后先写一个 mock 客户端，方便不接真实模型也能跑流程：

```ts
export class MockLLMClient implements LLMClient {
  async complete(messages: ChatMessage[]): Promise<LLMResponse> {
    const last = messages.at(-1)?.content ?? "";

    if (last.includes("读取")) {
      return {
        content: "我需要读取文件。",
        toolCalls: [
          {
            id: crypto.randomUUID(),
            name: "read_file",
            input: { path: "README.md" },
          },
        ],
      };
    }

    return {
      content: `收到：${last}`,
    };
  }
}
```

真实模型客户端可以后续实现。先用 mock 的好处是：

- 能先验证 Agent Runtime。
- 不依赖网络。
- 不消耗 token。

## 7. 第五步：设计工具接口

创建 `src/tools/registry.ts`：

```ts
import { z } from "zod";

export type ToolPermission = "read" | "write" | "execute_safe" | "execute_risky";

export type ToolDefinition<Input = unknown, Output = unknown> = {
  name: string;
  description: string;
  permission: ToolPermission;
  schema: z.ZodType<Input>;
  execute(input: Input): Promise<Output>;
};

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  list(): ToolDefinition[] {
    return [...this.tools.values()];
  }

  async execute(name: string, input: unknown): Promise<unknown> {
    const tool = this.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const parsed = tool.schema.parse(input);
    return tool.execute(parsed);
  }
}
```

设计重点：

- 每个工具都有 schema。
- 执行前必须校验参数。
- 工具带权限等级，后面用于审批。

## 8. 第六步：实现文件读取工具

创建 `src/tools/read-file.ts`：

```ts
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";
import type { ToolDefinition } from "./registry.js";

const schema = z.object({
  path: z.string().min(1),
});

export const readFileTool: ToolDefinition<
  z.infer<typeof schema>,
  { path: string; content: string }
> = {
  name: "read_file",
  description: "Read a UTF-8 text file from the current workspace.",
  permission: "read",
  schema,
  async execute(input) {
    const fullPath = resolve(process.cwd(), input.path);
    const content = await readFile(fullPath, "utf8");

    return {
      path: fullPath,
      content: content.slice(0, 20_000),
    };
  },
};
```

注意：

- 这里先用了 `process.cwd()` 作为工作区。
- 后面安全章节会改成更严格的路径限制。
- 大文件必须截断，避免把上下文撑爆。

## 9. 第七步：实现列目录工具

创建 `src/tools/list-files.ts`：

```ts
import fg from "fast-glob";
import { z } from "zod";
import type { ToolDefinition } from "./registry.js";

const schema = z.object({
  pattern: z.string().default("**/*"),
});

export const listFilesTool: ToolDefinition<
  z.infer<typeof schema>,
  { files: string[] }
> = {
  name: "list_files",
  description: "List files in the workspace using a glob pattern.",
  permission: "read",
  schema,
  async execute(input) {
    const files = await fg(input.pattern, {
      cwd: process.cwd(),
      onlyFiles: true,
      ignore: ["node_modules/**", ".git/**", "dist/**"],
    });

    return {
      files: files.slice(0, 500),
    };
  },
};
```

## 10. 第八步：实现搜索工具

创建 `src/tools/search-text.ts`：

```ts
import { readFile } from "node:fs/promises";
import fg from "fast-glob";
import { z } from "zod";
import type { ToolDefinition } from "./registry.js";

const schema = z.object({
  query: z.string().min(1),
  pattern: z.string().default("**/*.{ts,tsx,js,jsx,json,md}"),
});

export const searchTextTool: ToolDefinition<
  z.infer<typeof schema>,
  { matches: Array<{ file: string; line: number; text: string }> }
> = {
  name: "search_text",
  description: "Search text in workspace files.",
  permission: "read",
  schema,
  async execute(input) {
    const files = await fg(input.pattern, {
      cwd: process.cwd(),
      onlyFiles: true,
      ignore: ["node_modules/**", ".git/**", "dist/**"],
    });

    const matches: Array<{ file: string; line: number; text: string }> = [];

    for (const file of files) {
      const content = await readFile(file, "utf8").catch(() => "");
      const lines = content.split(/\r?\n/);

      lines.forEach((line, index) => {
        if (line.includes(input.query)) {
          matches.push({
            file,
            line: index + 1,
            text: line.slice(0, 300),
          });
        }
      });

      if (matches.length >= 100) break;
    }

    return { matches };
  },
};
```

说明：

- 这是教学版实现。
- 真正项目中优先调用 `rg`，速度会快很多。
- 结果数量要限制，避免返回太多。

## 11. 第九步：实现命令执行工具

创建 `src/tools/run-command.ts`：

```ts
import { execa } from "execa";
import { z } from "zod";
import type { ToolDefinition } from "./registry.js";

const schema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
});

const allowedCommands = new Set(["node", "pnpm", "npm", "git"]);

export const runCommandTool: ToolDefinition<
  z.infer<typeof schema>,
  { exitCode: number; stdout: string; stderr: string }
> = {
  name: "run_command",
  description: "Run an allowed command in the workspace.",
  permission: "execute_safe",
  schema,
  async execute(input) {
    if (!allowedCommands.has(input.command)) {
      throw new Error(`Command is not allowed: ${input.command}`);
    }

    const result = await execa(input.command, input.args, {
      cwd: process.cwd(),
      reject: false,
      timeout: 60_000,
    });

    return {
      exitCode: result.exitCode ?? 0,
      stdout: result.stdout.slice(0, 20_000),
      stderr: result.stderr.slice(0, 20_000),
    };
  },
};
```

重点：

- 不要直接执行任意 shell 字符串。
- 命令和参数分开。
- 设置 allowlist。
- 设置超时。
- 截断输出。

## 12. 第十步：注册工具

创建 `src/tools/index.ts`：

```ts
import { ToolRegistry } from "./registry.js";
import { readFileTool } from "./read-file.js";
import { listFilesTool } from "./list-files.js";
import { searchTextTool } from "./search-text.js";
import { runCommandTool } from "./run-command.js";

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(readFileTool);
  registry.register(listFilesTool);
  registry.register(searchTextTool);
  registry.register(runCommandTool);

  return registry;
}
```

## 13. 第十一步：实现 Agent 状态

创建 `src/agent/state.ts`：

```ts
import type { AgentState, ChatMessage, AgentStep } from "./types.js";

export class InMemoryAgentState {
  private state: AgentState = {
    status: "idle",
    messages: [],
    steps: [],
  };

  get(): AgentState {
    return this.state;
  }

  setStatus(status: AgentState["status"]): void {
    this.state.status = status;
  }

  addMessage(message: ChatMessage): void {
    this.state.messages.push(message);
  }

  addStep(step: AgentStep): void {
    this.state.steps.push(step);
  }
}
```

教学阶段先用内存状态。后续可以替换成：

- JSON 文件。
- SQLite。
- Redis。
- 远程数据库。

## 14. 第十二步：实现日志

创建 `src/logging/logger.ts`：

```ts
export type Logger = {
  info(message: string, meta?: unknown): void;
  error(message: string, meta?: unknown): void;
};

export const consoleLogger: Logger = {
  info(message, meta) {
    console.log(`[info] ${message}`);
    if (meta) console.dir(meta, { depth: 5 });
  },
  error(message, meta) {
    console.error(`[error] ${message}`);
    if (meta) console.dir(meta, { depth: 5 });
  },
};
```

Agent 必须可观察。没有日志，后面会非常难调。

## 15. 第十三步：实现 Agent Runtime

创建 `src/agent/runtime.ts`：

```ts
import type { LLMClient } from "../llm/client.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { Logger } from "../logging/logger.js";
import { InMemoryAgentState } from "./state.js";
import type { ChatMessage } from "./types.js";

export type AgentRuntimeOptions = {
  llm: LLMClient;
  tools: ToolRegistry;
  logger: Logger;
  maxIterations?: number;
};

export class AgentRuntime {
  private state = new InMemoryAgentState();
  private maxIterations: number;

  constructor(private options: AgentRuntimeOptions) {
    this.maxIterations = options.maxIterations ?? 8;
  }

  async run(userInput: string): Promise<string> {
    this.state.setStatus("running");
    this.state.addMessage({ role: "user", content: userInput });

    for (let i = 0; i < this.maxIterations; i++) {
      this.options.logger.info(`LLM iteration ${i + 1}`);

      const messages = this.buildMessages();
      const response = await this.options.llm.complete(messages);

      this.state.addStep({
        type: "llm",
        inputMessages: messages,
        output: response,
      });

      if (!response.toolCalls?.length) {
        this.state.addMessage({
          role: "assistant",
          content: response.content,
        });
        this.state.setStatus("done");
        return response.content;
      }

      for (const toolCall of response.toolCalls) {
        this.options.logger.info(`Tool call: ${toolCall.name}`, toolCall.input);

        try {
          const output = await this.options.tools.execute(
            toolCall.name,
            toolCall.input,
          );

          this.state.addStep({
            type: "tool",
            toolName: toolCall.name,
            input: toolCall.input,
            output,
          });

          this.state.addMessage({
            role: "tool",
            content: JSON.stringify({
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              output,
            }),
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);

          this.state.addStep({
            type: "tool",
            toolName: toolCall.name,
            input: toolCall.input,
            output: message,
            isError: true,
          });

          this.state.addMessage({
            role: "tool",
            content: JSON.stringify({
              toolCallId: toolCall.id,
              toolName: toolCall.name,
              error: message,
            }),
          });
        }
      }
    }

    this.state.setStatus("failed");
    return "任务未在最大迭代次数内完成。";
  }

  private buildMessages(): ChatMessage[] {
    const system: ChatMessage = {
      role: "system",
      content: [
        "You are a helpful Node.js coding agent.",
        "Use tools when needed.",
        "When you have enough information, respond with a final answer.",
      ].join("\n"),
    };

    return [system, ...this.state.get().messages];
  }
}
```

这就是 Agent 的核心循环：

```text
LLM → tool_call → execute tool → tool_result → LLM → final answer
```

## 16. 第十四步：实现 CLI 入口

创建 `src/index.ts`：

```ts
import { AgentRuntime } from "./agent/runtime.js";
import { MockLLMClient } from "./llm/client.js";
import { createToolRegistry } from "./tools/index.js";
import { consoleLogger } from "./logging/logger.js";

const input = process.argv.slice(2).join(" ");

if (!input) {
  console.error('Usage: pnpm dev "读取 README 并总结"');
  process.exit(1);
}

const agent = new AgentRuntime({
  llm: new MockLLMClient(),
  tools: createToolRegistry(),
  logger: consoleLogger,
});

const result = await agent.run(input);

console.log("\n=== Final Answer ===");
console.log(result);
```

运行：

```bash
pnpm dev "读取 README 并总结"
```

如果当前目录有 `README.md`，mock 模型会触发 `read_file` 工具。

## 17. 第十五步：接入真实 LLM

不同模型 SDK 写法不同，但建议统一成 `LLMClient` 接口。

伪代码结构：

```ts
export class RealLLMClient implements LLMClient {
  async complete(messages: ChatMessage[]): Promise<LLMResponse> {
    const response = await provider.messages.create({
      model: "...",
      messages: convertMessages(messages),
      tools: convertTools(),
    });

    return convertResponse(response);
  }
}
```

关键不是某个 SDK 的具体写法，而是保持三层分离：

```text
Agent Runtime 不关心模型 SDK
LLM Client 负责适配模型格式
Tool Registry 负责真实工具执行
```

这样后续你可以切换模型提供商，Agent 主流程不用大改。

## 18. 第十六步：让模型知道有哪些工具

真实 LLM 要调用工具，需要把工具描述传给模型。

你可以从 `ToolRegistry.list()` 生成工具说明：

```ts
function renderToolInstructions(tools: ToolDefinition[]): string {
  return tools
    .map((tool) => {
      return [
        `Tool: ${tool.name}`,
        `Description: ${tool.description}`,
        `Permission: ${tool.permission}`,
      ].join("\n");
    })
    .join("\n\n");
}
```

如果模型提供原生 tool calling，就转成 SDK 要求的 schema。

如果没有原生工具调用，可以要求模型输出 JSON：

```json
{
  "type": "call_tool",
  "toolName": "read_file",
  "input": {
    "path": "README.md"
  }
}
```

但要注意：自然语言中的 JSON 可能格式错误，所以优先使用模型提供商的结构化输出或函数调用能力。

## 19. 第十七步：加入权限确认

现在 `run_command` 会执行命令。即使有 allowlist，也应该加入权限策略。

创建 `src/permissions/policy.ts`：

```ts
import type { ToolDefinition } from "../tools/registry.js";

export type PermissionDecision =
  | { type: "allow" }
  | { type: "deny"; reason: string }
  | { type: "ask" };

export function decideToolPermission(tool: ToolDefinition): PermissionDecision {
  if (tool.permission === "read") {
    return { type: "allow" };
  }

  if (tool.permission === "execute_safe") {
    return { type: "ask" };
  }

  return {
    type: "deny",
    reason: `Permission is not allowed: ${tool.permission}`,
  };
}
```

Runtime 执行工具前：

```ts
const tool = this.options.tools.get(toolCall.name);
if (!tool) throw new Error(`Unknown tool: ${toolCall.name}`);

const decision = decideToolPermission(tool);
if (decision.type === "deny") {
  throw new Error(decision.reason);
}
if (decision.type === "ask") {
  // CLI 中可以提示用户 y/N
}
```

教学版可以先把 `ask` 当作拒绝。正式版再接入交互确认。

## 20. 第十八步：限制文件系统边界

读取文件不能无限制读整个电脑。需要保证路径在 workspace 内。

工具函数：

```ts
import { relative, resolve } from "node:path";

export function resolveWorkspacePath(workspace: string, inputPath: string): string {
  const fullPath = resolve(workspace, inputPath);
  const rel = relative(workspace, fullPath);

  if (rel.startsWith("..") || rel === "") {
    throw new Error(`Path is outside workspace: ${inputPath}`);
  }

  return fullPath;
}
```

注意：如果允许读取工作区根目录文件，`rel === ""` 这个条件需要调整。真实项目中最好分清文件路径和目录路径。

## 21. 第十九步：加入上下文裁剪

Agent 多轮调用后，消息会变长。需要做简单裁剪。

示例：

```ts
function trimMessages(messages: ChatMessage[], maxMessages = 20): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;

  const first = messages[0];
  const recent = messages.slice(-maxMessages + 1);

  return [
    first,
    {
      role: "system",
      content: "Earlier messages were omitted to keep context short.",
    },
    ...recent,
  ];
}
```

更好的做法：

- 将旧历史摘要成一条 memory。
- 保留用户目标。
- 保留关键工具结果。
- 丢弃大型中间输出。

## 22. 第二十步：加入计划

Agent 做复杂任务时，需要显式计划。

可以在状态中加入：

```ts
export type PlanItem = {
  id: string;
  content: string;
  status: "pending" | "in_progress" | "done";
};
```

然后让模型输出 action：

```ts
type AgentAction =
  | { type: "update_plan"; items: PlanItem[] }
  | { type: "call_tool"; name: string; input: unknown }
  | { type: "final"; content: string };
```

为什么计划重要：

- 用户能看到 Agent 在做什么。
- Agent 自己更不容易跑偏。
- 长任务可以恢复。
- 失败时更容易定位。

## 23. 第二十一步：加入记忆

### 23.1 短期记忆

短期记忆就是当前任务状态：

- 用户目标。
- 最近消息。
- 当前计划。
- 工具调用结果。

前面的 `InMemoryAgentState` 已经是短期记忆。

### 23.2 长期记忆

先实现最简单的 JSON 文件记忆。

```ts
export type MemoryItem = {
  id: string;
  text: string;
  createdAt: string;
  tags: string[];
};
```

用法：

- 用户偏好：喜欢中文回答。
- 项目偏好：测试命令是 `pnpm test`。
- 历史经验：某类错误通常由某个配置引起。

不要一开始就上向量数据库。等 JSON 记忆不够时，再加入 embedding。

## 24. 第二十二步：支持文件写入

写文件是 coding agent 的核心能力，但风险也更高。

建议先实现：

- 只能写工作区内文件。
- 写之前生成 diff。
- 用户确认后再写。
- 写入前备份原文件或记录 patch。

工具接口：

```ts
type WriteFileInput = {
  path: string;
  content: string;
};
```

权限：

```ts
permission: "write"
```

Runtime 看到 `write` 权限必须要求确认。

## 25. 第二十三步：做一个 Mini Coding Agent

现在可以组合成一个 mini coding agent。

目标输入：

```text
帮我修复当前项目里失败的测试
```

Agent 流程：

```text
1. list_files 查看项目结构
2. read_file 读取 package.json
3. run_command 执行测试
4. search_text 搜索失败相关代码
5. read_file 读取目标文件
6. 生成修改计划
7. write_file 修改代码
8. run_command 再次测试
9. 输出总结
```

这就是 Claude Code / Codex 类工具的极简原型。

## 26. 第二十四步：加入 TUI

CLI 能跑后，再做 TUI。

TUI 应该展示：

- 用户输入。
- 模型回答。
- 当前计划。
- 工具调用状态。
- 工具结果摘要。
- 权限确认弹窗。
- 错误信息。

推荐库：

- `ink`：React 写法，适合现代 Node.js TUI。
- `blessed`：更底层，布局能力强。

不要一开始就做 TUI。先把 runtime 做稳定，再加界面。

## 27. 第二十五步：测试你的 Agent

Agent 项目测试分三类。

### 27.1 单元测试

测试：

- 工具 schema。
- 路径限制。
- 权限策略。
- 上下文裁剪。

### 27.2 集成测试

测试：

- LLM 返回 tool call 后是否能执行工具。
- 工具失败后模型是否能继续。
- 最大迭代次数是否生效。

### 27.3 任务评估

准备一组真实任务：

```text
总结 README
查找某个函数定义
解释测试失败原因
修改一个简单 bug
生成一份文档
```

每次改 prompt 或工具定义后，跑这组任务，比较成功率。

## 28. 工程化清单

上线或长期使用前，至少完成：

- [ ] 所有工具都有 schema。
- [ ] 文件路径限制在 workspace 内。
- [ ] 命令执行有 allowlist。
- [ ] 高风险操作需要用户确认。
- [ ] 所有工具输出有长度限制。
- [ ] Agent 有最大迭代次数。
- [ ] LLM 请求和工具调用有日志。
- [ ] 支持取消任务。
- [ ] 支持恢复或查看历史任务。
- [ ] 支持错误提示和重试。
- [ ] `.env` 不提交。
- [ ] API Key 不出现在日志里。

## 29. 常见错误

### 29.1 一开始就做全自动

全自动 Agent 很诱人，但难调试。先做固定 workflow，再做自主循环。

### 29.2 工具太多

工具越多，模型越容易选错。先提供少量高质量工具。

### 29.3 工具描述不清楚

工具描述就是给模型看的文档。描述差，模型就会误用。

### 29.4 输出不结构化

让模型输出“我想调用 read_file”再用字符串解析，会很脆弱。尽量用 tool calling 或严格 JSON schema。

### 29.5 没有失败处理

工具失败、参数错误、文件不存在、命令超时都是正常情况。Agent 必须能看到失败并调整。

### 29.6 不限制上下文

把所有文件和所有日志都塞给模型，会导致成本高、速度慢、效果差。

## 30. 最终你应该理解什么

完成这个教程后，你应该理解：

- Agent 的核心是反馈循环，不是单次调用。
- Node.js 负责工具执行、状态管理和安全边界。
- LLM 负责推理、计划和选择行动。
- 工具设计会极大影响 Agent 能力。
- 权限模型不是附加功能，而是基础设施。
- 可观测性决定你能否调试复杂任务。
- Coding agent 的关键闭环是：修改、运行测试、读取反馈、再修改。

## 31. 下一步学习方向

完成从 0 到 1 后，可以继续深入：

1. 接入真实模型的原生 tool calling。
2. 加入流式输出。
3. 加入 JSON schema 结构化响应。
4. 加入 SQLite 会话存储。
5. 加入 embedding 和向量检索。
6. 实现 patch-based 文件编辑。
7. 实现多 Agent 协作。
8. 实现 TUI。
9. 实现任务评估集。
10. 对标 Claude Code / Codex 做 coding agent。

