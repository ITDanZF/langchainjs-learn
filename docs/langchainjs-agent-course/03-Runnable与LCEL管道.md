# 03. Runnable 与流式输出：让终端体验更自然

## 本章目标

本章让 `mini-agent ask` 支持流式输出。

完成后可以运行：

```bash
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

## 2. 扩展 Ask Chain

修改 `src/chains/ask.ts`：

```ts
export async function streamAsk(input: string) {
  return createAskChain().stream({ input });
}
```

保留上一章的 `ask()`，这样 CLI 可以通过参数切换。

## 3. 流式输出工具

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

## 4. CLI 增加 --no-stream

修改 `ask` 命令：

```ts
import { ask, streamAsk } from "./chains/ask.js";
import { writeTextStream } from "./utils/stream.js";

program
  .command("ask")
  .description("Ask a single question")
  .argument("<input...>", "question text")
  .option("--no-stream", "disable streaming output")
  .action(async (input: string[], options: { stream: boolean }) => {
    const question = joinArgs(input);
    if (!ensureInput(question, "请输入问题")) return;

    if (options.stream) {
      const stream = await streamAsk(question);
      await writeTextStream(stream);
      return;
    }

    const response = await ask(question);
    console.log(response.content);
  });
```

## 5. Runnable 知识体系

LangChain.js 中许多对象都遵循 Runnable 风格：

| 方法 | 作用 |
| --- | --- |
| `invoke()` | 单次调用 |
| `stream()` | 流式调用 |
| `batch()` | 批量调用 |
| `pipe()` | 串联步骤 |

理解 Runnable 后，后续的 Prompt、模型、解析器、检索器都可以统一组合。

## 6. 验收

```bash
npm run dev -- ask "请用 5 点说明企业级 Agent CLI 需要哪些模块"
```

你应该看到回答逐步出现在终端。

## 7. 企业级思考

流式输出不只是体验问题，也会影响架构：

- CLI 需要区分普通结果、token、工具事件和错误事件。
- 日志系统不能污染标准输出。
- 如果后续接入 WebSocket，同样可以复用 stream 层。

下一章会开始实现工具系统，让 Agent 能访问本地项目。
