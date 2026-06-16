# 03. Runnable 与 LCEL 管道

## 本章目标

本章学习 LangChain.js 的核心抽象：`Runnable`。

你会把上一章的流程：

```text
prompt.formatMessages(input)
chatModel.invoke(messages)
```

改成更框架化的 LCEL 管道：

```text
prompt.pipe(model).pipe(parser)
```

## 1. Runnable 是什么

在 LangChain.js 里，很多对象都实现了 Runnable：

- PromptTemplate。
- ChatModel。
- OutputParser。
- Tool。
- Chain。
- 自定义函数包装后的 Runnable。

Runnable 的共同特点是：

```ts
await runnable.invoke(input)
```

也就是说，它们都可以接收输入并产生输出。

## 2. 创建基础 Chain

创建 `src/chains/basic-chain.ts`：

```ts
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { chatModel } from "../models/chat";

const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个清晰、耐心的技术老师。"],
  ["human", "请解释：{topic}"],
]);

export const basicChain = prompt.pipe(chatModel).pipe(new StringOutputParser());
```

这条链的含义是：

```text
输入 { topic }
  ↓
prompt 生成 messages
  ↓
chatModel 调用大模型
  ↓
StringOutputParser 提取文本
```

## 3. 在入口中调用 Chain

修改 `src/index.ts`：

```ts
import { basicChain } from "./chains/basic-chain";

const topic = process.argv.slice(2).join(" ").trim();

if (!topic) {
  console.error("请输入要解释的主题");
  process.exit(1);
}

const result = await basicChain.invoke({ topic });
console.log(result);
```

运行：

```bash
npm run dev "什么是 agent loop"
```

## 4. LCEL 的 pipe 思维

LCEL 是 LangChain Expression Language。

你可以把它理解成“把多个可运行组件接起来”：

```ts
const chain = step1.pipe(step2).pipe(step3);
```

和普通函数组合类似：

```text
step3(step2(step1(input)))
```

只是每一步都支持异步、流式、批处理、追踪和组合。

## 5. 流式输出

很多 CLI 或 TUI 都需要边生成边显示。

```ts
const stream = await basicChain.stream({
  topic: "LangChain.js 的 Runnable",
});

for await (const chunk of stream) {
  process.stdout.write(chunk);
}

process.stdout.write("\n");
```

## 6. 批处理

如果要同时处理多个输入：

```ts
const results = await basicChain.batch([
  { topic: "ChatModel" },
  { topic: "Tool" },
  { topic: "LangGraph" },
]);

console.log(results);
```

## 7. 本章验收

完成后，你应该能：

- 理解 Runnable 是 LangChain.js 的组合单元。
- 使用 `prompt.pipe(model).pipe(parser)`。
- 用 `invoke` 执行单次调用。
- 用 `stream` 做流式输出。
- 用 `batch` 做批量处理。

下一章会把第一版的 Tool 系统迁移到 LangChain.js 的 `tool()`。
