# 02. 模型与 Prompt：实现 mini-agent ask

## 本章目标

本章让 `mini-agent ask` 从占位输出变成真实模型回答。

你会新增：

```text
src/models/chat.ts
src/prompts/system.ts
src/chains/ask.ts
```


## 0. 开始前确认 package.json

进入本章前，先确认第 01 章的 `package.json` 至少已经具备这些关键配置：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@langchain/core": "...",
    "@langchain/openai": "...",
    "dotenv": "...",
    "zod": "...",
    "commander": "..."
  },
  "devDependencies": {
    "tsx": "...",
    "typescript": "...",
    "@types/node": "..."
  }
}
```

如果你的项目还是最初的 CommonJS 配置：

```json
{
  "type": "commonjs",
  "main": "index.js"
}
```

需要先回到第 01 章完成改造。否则本章里的 `import ... from`、`.js` 后缀导入和 `tsx src/cli.ts` 都可能报错。

本章会第一次真正加载 `.env` 并调用模型，所以也要确认：

```bash
cp .env.example .env
```

然后在 `.env` 中填入：

```bash
DEEPSEEK_API_KEY=你的 key
```

## 1. 模型封装

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

## 2. 系统 Prompt

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

## 3. Ask Chain

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

## 4. 输入校验工具

创建 `src/utils/input.ts`：

```ts
export function joinArgs(args: string[]) {
  return args.join(" ").trim();
}

export function ensureInput(input: string, message = "请输入内容") {
  if (input.length > 0) return true;

  console.error(message);
  process.exitCode = 1;
  return false;
}
```

## 5. 接入 CLI

修改 `src/cli.ts` 的 `ask` 命令：

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

## 6. 验收

```bash
npm run dev -- ask "用一句话解释 LangChain.js Agent"
```

如果 `.env` 配置正确，你会得到模型回答。

## 7. 企业级思考

现在代码很少，但已经埋下了企业项目的关键边界：

- `models/` 负责模型供应商适配。
- `prompts/` 负责行为规则。
- `chains/` 负责可复用调用链。
- `cli.ts` 只负责命令解析，不直接写模型逻辑。

下一章会把一次性输出改为流式输出，提升 CLI 体验。
