# 03. 交互会话、Runnable 与流式输出

## 本章目标

你现在已经有了能真实调用模型的 `ask()` 能力。第 01、02 章用 `ask` 子命令完成了最小闭环，但真正的 Agent CLI 更适合直接进入交互会话。

本章把 CLI 主入口改成 `chatAgent`：

1. 直接运行 `npm run dev` 进入交互式循环。
2. 运行 `npm run dev -- --version` 打印版本号。
3. 再把交互会话的完整输出改造成流式输出。

完成后可以运行：

```bash
npm run dev
npm run dev -- --version
```

## 1. 为什么去掉 ask 子命令

`ask` 子命令适合教学早期验证模型调用：

```bash
npm run dev -- ask "你好"
```

但进入交互式 Agent 阶段后，更自然的体验是：

```bash
chatAgent
```

本地开发时对应：

```bash
npm run dev
```

用户打开程序后直接输入问题，不需要每轮都敲 `ask`。`ask()` 仍然可以作为内部模型调用函数保留，但 CLI 暂时不再暴露 `ask` 子命令。

## 2. 交互循环

创建 `src/cli/chat-loop.ts`：

```ts
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type ChatLoopOptions = {
  handleInput: (input: string) => Promise<void> | void;
};

export async function startChatLoop(options: ChatLoopOptions) {
  const rl = createInterface({ input, output });

  console.log("chatAgent interactive session");
  console.log("输入 /exit 退出。\n");

  try {
    while (true) {
      const line = (await rl.question("> ")).trim();

      if (!line) continue;
      if (line === "/exit" || line === "/quit") break;

      await options.handleInput(line);
    }
  } finally {
    rl.close();
  }
}
```

这个文件只负责终端交互，不知道 LangChain，也不知道模型。它只做一件事：循环读入用户输入，然后交给 `handleInput()`。

## 3. CLI 接入默认交互会话

修改 `src/main.ts`。这一章不再注册 `askCommand`，只保留程序名、版本号和默认 action：

```ts
import { Command } from "commander";
import { ask } from "./model/AskChain.ts";
import { startChatLoop } from "./cli/chat-loop.ts";

async function handleUserInput(input: string) {
  const response = await ask(input);
  console.log(response.content);
}

async function main() {
  const program = new Command();

  program.name("chatAgent");
  program.version("0.1.0");

  program.action(async () => {
    await startChatLoop({
      handleInput: handleUserInput,
    });
  });

  await program.parseAsync(process.argv);
}

main();
```

这里的 `program.name()` 和 `program.version()` 主要服务于 CLI 元信息：

```bash
npm run dev -- --version
npm run dev -- --help
```

真正启动交互循环的是：

```ts
program.action(async () => {
  await startChatLoop({
    handleInput: handleUserInput,
  });
});
```

## 4. 先验收交互模式

运行：

```bash
npm run dev
```

输入：

```text
> 请用 5 点说明企业级 Agent CLI 需要哪些模块
```

你应该看到完整回答输出到终端。继续输入下一句，程序仍然留在会话里。

退出会话：

```text
> /exit
```

验证版本号：

```bash
npm run dev -- --version
```

到这里为止，本章第一步完成：CLI 已经从“一次性 ask 命令”升级成了“默认交互会话”。

## 5. 为什么再做流式输出

Agent CLI 的响应可能需要几秒甚至几十秒。如果等完整结果生成后才显示，用户会觉得程序卡住。

流式输出的体验是：

```text
模型生成一点 → 终端显示一点 → 用户持续看到进度
```

LangChain.js 的 Runnable 支持 `invoke()` 和 `stream()`，因此同一条链可以同时支持普通调用和流式调用。

## 6. 扩展 Ask Chain

修改 `src/model/AskChain.ts`：

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { baseSystemPrompt } from "./prompts/system.ts";
import { createChatModel } from "./chat.js";

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

export async function streamAsk(input: string) {
  return createAskChain().stream({ input });
}
```

`ask()` 保留为非流式调用，`streamAsk()` 用于交互会话的默认输出。

## 7. 流式输出工具

创建 `src/utils/stream.ts`：

```ts
export async function writeTextStream(stream: AsyncIterable<unknown>) {
  for await (const chunk of stream) {
    const text = extractText(chunk);
    if (text) process.stdout.write(text);
  }

  process.stdout.write("\n");
}

function extractText(chunk: unknown) {
  if (
    typeof chunk === "object" &&
    chunk !== null &&
    "content" in chunk &&
    typeof chunk.content === "string"
  ) {
    return chunk.content;
  }

  return "";
}
```

这是教学版实现。生产项目中可以进一步处理 reasoning、tool event、错误事件和 JSON chunk。

## 8. CLI 改造成默认流式输出

继续修改 `src/main.ts`：

```ts
import { Command } from "commander";
import { streamAsk } from "./model/AskChain.ts";
import { startChatLoop } from "./cli/chat-loop.ts";
import { writeTextStream } from "./utils/stream.ts";

async function handleUserInput(input: string) {
  const stream = await streamAsk(input);
  await writeTextStream(stream);
}

async function main() {
  const program = new Command();

  program.name("chatAgent");
  program.version("0.1.0");

  program.action(async () => {
    await startChatLoop({
      handleInput: handleUserInput,
    });
  });

  await program.parseAsync(process.argv);
}

main();
```

现在交互式输入的每一轮都会流式输出，不再需要 `--no-stream` 这样的教学分支。后续如果确实需要调试非流式结果，可以再单独加调试命令。

## 9. Runnable 知识体系

LangChain.js 中许多对象都遵循 Runnable 风格：

| 方法 | 作用 |
| --- | --- |
| `invoke()` | 单次调用 |
| `stream()` | 流式调用 |
| `batch()` | 批量调用 |
| `pipe()` | 串联步骤 |

理解 Runnable 后，后续的 Prompt、模型、解析器、检索器都可以统一组合。

本章的关键不是只学会 `stream()`，而是看到一个更清晰的演进顺序：

```text
ask 子命令验证模型 → 默认交互会话 → 会话默认流式输出
```

## 10. 最终验收

验证交互模式：

```bash
npm run dev
```

输入：

```text
> 请用 5 点说明企业级 Agent CLI 需要哪些模块
```

你应该看到回答逐步出现在终端。

验证版本号：

```bash
npm run dev -- --version
```

你应该看到：

```text
0.1.0
```

## 11. 企业级思考

交互循环和流式输出不只是体验问题，也会影响架构：

- CLI 需要区分普通结果、token、工具事件和错误事件。
- 日志系统不能污染标准输出。
- 如果后续接入 WebSocket，同样可以复用 stream 层。
- `handleUserInput()` 会逐渐演进为应用服务层入口，而不是散落在各个命令里。

下一章会开始实现工具系统，让 Agent 能访问本地项目。
