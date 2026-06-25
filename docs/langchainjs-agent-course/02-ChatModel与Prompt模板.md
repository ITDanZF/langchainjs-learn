# 02. 模型与 Prompt：实现 mini-agent ask

## 本章目标

本章让 `mini-agent ask` 从占位输出变成真实模型回答。

你会新增：

```text
src/config/env.ts
src/config/home.ts
src/models/chat.ts
src/prompts/system.ts
src/chains/ask.ts
```

你会安装：

```bash
npm install @langchain/core @langchain/openai dotenv zod
```

## 0. 开始前确认 package.json

进入本章前，先确认第 01 章已经完成，`package.json` 至少有 `type: "module"` 和 `dev` 脚本：

如果你的项目还是最初的 CommonJS 配置：

```json
{
  "type": "commonjs",
  "main": "index.js"
}
```

需要先回到第 01 章完成改造。否则本章里的 `import ... from`、`.js` 后缀导入和 `tsx src/main.ts` 都可能报错。

## 1. 环境变量模板

本章会第一次真正加载 `.env` 并调用模型，所以现在才创建 `.env.example`：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENT_WORKSPACE=.
MINI_AGENT_HOME=
LOG_LEVEL=info
```

本地复制：

```bash
cp .env.example .env
```

然后在 `.env` 中填入：

```bash
DEEPSEEK_API_KEY=你的 key
```

`AGENT_WORKSPACE` 表示当前 Agent 可以观察和操作的项目目录。`MINI_AGENT_HOME` 表示 mini-agent 自己的本地状态目录，类似 Codex 的 `%USERPROFILE%\.codex`。如果不配置，程序会默认使用用户目录下的 `.mini-agent`。

`MINI_AGENT_HOME=` 留空即可使用默认值。如果用户希望把配置、历史、会话和缓存放到其他磁盘，可以显式配置，例如 `MINI_AGENT_HOME=D:\mini-agent-home`。

`AGENT_WORKSPACE`、`MINI_AGENT_HOME` 和 `LOG_LEVEL` 暂时不会在本章发挥明显作用，但后续文件工具、会话历史、日志模块和缓存都会复用这些配置。

## 2. 配置模块

创建 `src/config/env.ts`：

```ts
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1, "DEEPSEEK_API_KEY is required"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  AGENT_WORKSPACE: z.string().default("."),
  MINI_AGENT_HOME: z.string().optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = EnvSchema.parse(process.env);
```

配置从这一章开始集中校验。后续模块只导入 `env`，不要在业务代码里到处读取 `process.env`。

## 3. 本地状态目录

Codex 第一次运行后会在用户目录下创建 `.codex`，用于保存全局配置、认证、历史、会话、日志和缓存。`mini-agent-langchain` 也可以采用同样的思路，但使用自己的目录名，避免和其他工具混在一起。

这个路径由程序生成：优先读取 `MINI_AGENT_HOME`，如果用户没有配置，就使用 `path.join(homedir(), ".mini-agent")`。

推荐目录：

```text
Windows:
C:\Users\<你>\.mini-agent

macOS / Linux:
~/.mini-agent
```

创建 `src/config/home.ts`：

```ts
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { env } from "./env.js";

export function getAgentHome() {
  return env.MINI_AGENT_HOME || path.join(homedir(), ".mini-agent");
}

export async function ensureAgentHome() {
  const home = getAgentHome();

  await mkdir(home, { recursive: true });
  await mkdir(path.join(home, "sessions"), { recursive: true });
  await mkdir(path.join(home, "logs"), { recursive: true });
  await mkdir(path.join(home, "cache"), { recursive: true });
  await mkdir(path.join(home, "skills"), { recursive: true });
  await mkdir(path.join(home, "plugins"), { recursive: true });

  return home;
}
```

第一次运行 CLI 时，调用 `ensureAgentHome()`，程序就会自动创建：

```text
~/.mini-agent/
  sessions/
  logs/
  cache/
  skills/
  plugins/
```

后续可以继续在这个目录里放：

```text
config.toml       # 全局配置
auth.json         # 认证信息，不提交 git
history.jsonl     # 命令历史
```

注意区分两个目录：

| 目录 | 作用 |
| --- | --- |
| `AGENT_WORKSPACE` | Agent 当前处理的项目目录，例如 `E:\workspace\agent-tui` |
| `MINI_AGENT_HOME` | mini-agent 自己的本地状态目录，例如 `%USERPROFILE%\.mini-agent` |

在 `src/main.ts` 的启动流程中尽早调用：

```ts
import { ensureAgentHome } from "./config/home.js";

async function main() {
  await ensureAgentHome();

  // commander 初始化和命令注册...
}
```

这样配置、缓存、历史和会话就有了统一落点。后续实现 `config`、`session`、`history` 等命令时，都不要散落写入项目源码目录，而是优先写入 `MINI_AGENT_HOME`。

## 4. 模型封装

创建 `src/models/chat.ts`：

```ts
import { ChatOpenAI } from "@langchain/openai";
import { env } from "../config/env.js";

export function createChatModel() {
  return new ChatOpenAI({
    model: env.DEEPSEEK_MODEL,
    apiKey: env.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: env.DEEPSEEK_BASE_URL,
    },
  });
}
```

这里使用 `ChatOpenAI` 是因为 DeepSeek 提供 OpenAI 兼容接口。后续如果换模型，只需要替换这个模块。

## 5. 系统 Prompt

创建 `src/prompts/system.ts`：

```ts
export const baseSystemPrompt = `
你是 mini-agent-langchain 项目中的企业级命令行 Agent。

回答规则：
1. 先给结论，再给必要步骤。
2. 涉及命令、路径、代码时使用 Markdown 代码格式。
3. 不要声称已经读取文件或执行命令，除非工具结果明确提供。
4. 如果信息不足，说明缺什么，而不是编造。
5. 输出要适合终端阅读，简洁、清晰、可操作。
`.trim();
```

企业级 Prompt 的重点不是“人设”，而是行为边界。

## 6. Ask Chain

创建 `src/chains/ask.ts`：

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { createChatModel } from "../models/chat.js";
import { baseSystemPrompt } from "../prompts/system.js";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", baseSystemPrompt],
  ["human", "{input}"],
]);

export function createAskChain() {
  return prompt.pipe(createChatModel());
}

export async function ask(input: string) {
  return createAskChain().invoke({ input });
}
```

这条链路是：

```text
input → prompt → chat model → AIMessage
```

## 7. 接入 CLI

修改 `src/main.ts` 的 `ask` 命令：

```ts
import { ask } from "./chains/ask.js";
import { ensureInput, joinArgs } from "./utils/input.js";

program
  .command("ask")
  .description("Ask a single question")
  .argument("<input...>", "question text")
  .action(async (input: string[]) => {
    const question = joinArgs(input);
    if (!ensureInput(question, "请输入问题")) return;

    const response = await ask(question);
    console.log(response.content);
  });
```

这里复用第 01 章已经创建的 `joinArgs()` 和 `ensureInput()`。

## 8. 验收

```bash
npm run dev -- ask "用一句话解释 LangChain.js Agent"
```

如果 `.env` 配置正确，你会得到模型回答。

## 9. 本章暂不做什么

本章只解决单次问答，不做：

- 流式输出：第 03 章再做。
- 文件工具：第 04 章再做。
- `run` 命令：第 05 章再做。
- LangGraph：第 06 章再做。

## 10. 企业级思考

现在代码很少，但已经埋下了企业项目的关键边界：

- `models/` 负责模型供应商适配。
- `prompts/` 负责行为规则。
- `chains/` 负责可复用调用链。
- `config/home.ts` 负责本地状态目录，避免历史、缓存、会话散落在项目里。
- `main.ts` 只负责命令解析，不直接写模型逻辑。

下一章会把一次性输出改为流式输出，提升 CLI 体验。
