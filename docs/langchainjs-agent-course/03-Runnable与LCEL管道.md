# 03. Runnable、流式输出与交互会话

## 本章目标

你现在已经有了能真实调用模型的 `mini-agent ask`。本章在不推翻前两章代码的基础上，做两件事：

- 让 `ask` 支持流式输出。
- 新增一个类似 Claude Code 的交互会话入口：直接运行 `npm run dev` 或 `npm run dev -- chat` 后，可以连续输入问题。

完成后可以运行：

```bash
npm run dev
npm run dev -- ask "给我一个学习计划"
npm run dev -- ask --no-stream "给我一个学习计划"
```

## 1. 为什么要流式输出

Agent CLI 的响应可能需要几秒甚至几十秒。如果等完整结果生成后才显示，用户会觉得程序卡住。

流式输出的体验是：

```text
模型生成一点 → 终端显示一点 → 用户持续看到进度
```

LangChain.js 的 Runnable 支持 `invoke()` 和 `stream()`，因此同一条链可以同时支持普通调用和流式调用。

## 2. 为什么现在才加交互会话

第 01 章只做 `ask` 占位，第 02 章只让 `ask` 能真实回答，是为了先把命令行、模型、Prompt、Chain 这些基础概念讲清楚。

现在模型调用已经跑通，再把入口升级成 Claude Code 式体验就很自然：

```text
一次性命令：mini-agent ask "问题"
交互会话：mini-agent
显式会话：mini-agent chat
```

这样你不需要从头学一遍，只是在已有 `ask(question)` 之上多包一层循环输入。

## 3. 扩展 Ask Chain

修改 `src/chains/ask.ts`：

```ts
export async function streamAsk(input: string) {
  return createAskChain().stream({ input });
}
```

保留上一章的 `ask()`，这样 CLI 可以通过参数切换。

## 4. 流式输出工具

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

## 5. 交互循环

创建 `src/cli/chat-loop.ts`：

```ts
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type ChatLoopOptions = {
  handleInput: (input: string) => Promise<void> | void;
};

export async function startChatLoop(options: ChatLoopOptions) {
  const rl = createInterface({ input, output });

  console.log("mini-agent interactive session");
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

## 6. CLI 增加 chat 和 --no-stream

修改 `src/main.ts`，让交互会话默认使用流式输出，同时让 `ask` 可以用 `--no-stream` 关闭流式：

```ts
import { startChatLoop } from "./cli/chat-loop.js";
import { ask, streamAsk } from "./chains/ask.js";
import { writeTextStream } from "./utils/stream.js";

async function handleUserInput(input: string, options = { stream: true }) {
  if (options.stream) {
    const stream = await streamAsk(input);
    await writeTextStream(stream);
    return;
  }

  const response = await ask(input);
  console.log(response.content);
}

program
  .command("ask")
  .description("Ask a single question")
  .argument("<input...>", "question text")
  .option("--no-stream", "disable streaming output")
  .action(async (input: string[], options: { stream: boolean }) => {
    const question = joinArgs(input);
    if (!ensureInput(question, "请输入问题")) return;

    await handleUserInput(question, { stream: options.stream });
  });

program
  .command("chat")
  .description("Start an interactive session")
  .action(async () => {
    await startChatLoop({
      handleInput: (input) => handleUserInput(input),
    });
  });

program.action(async () => {
  await startChatLoop({
    handleInput: (input) => handleUserInput(input),
  });
});
```

注意：Commander 的 `--no-stream` 会把 `options.stream` 设为 `false`。不传这个参数时，默认是 `true`。

这里有一个重要设计点：`ask` 和 `chat` 共用 `handleUserInput()`。

```text
ask 负责一次性输入
chat 负责循环读入
handleUserInput 负责真正调用模型
```

这就是从“每次都要 ask 一下”过渡到“像 Claude Code 一样留在会话里”的关键。

## 7. Runnable 知识体系

LangChain.js 中许多对象都遵循 Runnable 风格：

| 方法 | 作用 |
| --- | --- |
| `invoke()` | 单次调用 |
| `stream()` | 流式调用 |
| `batch()` | 批量调用 |
| `pipe()` | 串联步骤 |

理解 Runnable 后，后续的 Prompt、模型、解析器、检索器都可以统一组合。

## 8. 验收

先验证交互模式：

```bash
npm run dev
```

输入：

```text
> 请用 5 点说明企业级 Agent CLI 需要哪些模块
```

你应该看到回答逐步出现在终端。

再验证一次性命令：

```bash
npm run dev -- ask "请用 5 点说明企业级 Agent CLI 需要哪些模块"
```

你应该看到回答逐步出现在终端。

## 9. 企业级思考

流式输出不只是体验问题，也会影响架构：

- CLI 需要区分普通结果、token、工具事件和错误事件。
- 日志系统不能污染标准输出。
- 如果后续接入 WebSocket，同样可以复用 stream 层。

下一章会开始实现工具系统，让 Agent 能访问本地项目。
