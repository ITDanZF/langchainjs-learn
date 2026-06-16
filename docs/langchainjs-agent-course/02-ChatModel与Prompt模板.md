# 02. ChatModel 与 Prompt 模板

## 本章目标

本章会用 LangChain.js 跑通第一次真实模型调用，并学习 Prompt 模板。

你会实现：

```text
用户输入
  ↓
PromptTemplate
  ↓
ChatModel
  ↓
模型回复
```

## 1. 创建 ChatModel

创建 `src/models/chat.ts`：

```ts
import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config";

export const chatModel = new ChatOpenAI({
  model: config.DEEPSEEK_MODEL,
  apiKey: config.DEEPSEEK_API_KEY,
  configuration: {
    baseURL: "https://api.deepseek.com",
  },
});
```

DeepSeek 提供 OpenAI 兼容接口，所以可以通过 `@langchain/openai` 的 `ChatOpenAI` 接入。

这里的 `ChatOpenAI` 可以理解成第一版课程里的 `DeepSeekLLMClient`。

## 2. 最小调用

创建 `src/index.ts`：

```ts
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { chatModel } from "./models/chat";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
  console.error("请输入问题");
  process.exit(1);
}

const response = await chatModel.invoke([
  new SystemMessage("你是一个命令行智能体助手。"),
  new HumanMessage(input),
]);

console.log(response.content);
```

运行：

```bash
npm run dev "你好，请用一句话介绍你自己"
```

## 3. 消息对象和第一版的关系

第一版我们自己定义：

```ts
export type ChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};
```

LangChain.js 使用消息类：

```ts
new SystemMessage("...")
new HumanMessage("...")
new AIMessage("...")
```

对应关系是：

| 第一版 role | LangChain.js 消息 |
| --- | --- |
| `system` | `SystemMessage` |
| `user` | `HumanMessage` |
| `assistant` | `AIMessage` |
| `tool` | `ToolMessage` |

## 4. 使用 PromptTemplate

直接手写消息可以跑通，但复杂应用里 Prompt 会越来越多。

创建 `src/prompts/templates.ts`：

```ts
import { ChatPromptTemplate } from "@langchain/core/prompts";

export const assistantPrompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个擅长 Node.js 和智能体开发的教学助手。"],
  ["human", "请回答这个问题：{question}"],
]);
```

改造 `src/index.ts`：

```ts
import { assistantPrompt } from "./prompts/templates";
import { chatModel } from "./models/chat";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
  console.error("请输入问题");
  process.exit(1);
}

const messages = await assistantPrompt.formatMessages({
  question: input,
});

const response = await chatModel.invoke(messages);
console.log(response.content);
```

## 5. 为什么要用模板

Prompt 模板的价值是：

- 把系统提示词集中管理。
- 用变量填充用户输入。
- 避免到处拼字符串。
- 方便复用和测试。
- 可以和 LCEL 管道组合。

## 6. 本章验收

完成后，你应该能：

- 用 LangChain.js 接入 DeepSeek。
- 理解 `ChatOpenAI` 和 `DeepSeekLLMClient` 的关系。
- 使用 `SystemMessage` 和 `HumanMessage`。
- 使用 `ChatPromptTemplate` 构造消息。

下一章会学习 LangChain.js 的核心组合方式：Runnable 和 LCEL。
