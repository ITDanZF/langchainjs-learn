# 05. 基于 createReactAgent 的工具智能体

## 本章目标

上一章已经创建了 LangChain Tool。本章要让模型自己决定什么时候调用工具。

你会实现：

```text
用户问题
  ↓
createReactAgent
  ↓
模型判断是否需要工具
  ↓
调用 read_file
  ↓
把工具结果交回模型
  ↓
生成最终回答
```

## 1. 准备工具列表

创建 `src/tools/index.ts`：

```ts
import { readFileTool } from "./read-file";

export const tools = [readFileTool];
```

后续可以继续加入：

- `search_text`
- `list_files`
- `run_command`
- `call_business_api`

## 2. 创建 ReAct Agent

创建 `src/agents/react-agent.ts`：

```ts
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { chatModel } from "../models/chat";
import { tools } from "../tools";

export const reactAgent = createReactAgent({
  llm: chatModel,
  tools,
});
```

`createReactAgent` 会帮你处理：

- 模型调用。
- 工具选择。
- 工具参数生成。
- 工具执行。
- 工具结果回填。
- 最终回答。

## 3. 调用 Agent

修改 `src/index.ts`：

```ts
import { HumanMessage } from "@langchain/core/messages";
import { reactAgent } from "./agents/react-agent";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
  console.error("请输入任务");
  process.exit(1);
}

const result = await reactAgent.invoke({
  messages: [new HumanMessage(input)],
});

const lastMessage = result.messages.at(-1);
console.log(lastMessage?.content);
```

运行：

```bash
npm run dev "请阅读 package.json 并总结这个项目用到了哪些依赖"
```

## 4. ReAct 是什么

ReAct 可以简单理解为：

```text
Reasoning + Acting
```

模型不是一次性回答，而是可以在中间决定：

```text
我需要查看文件
  ↓
调用 read_file
  ↓
看完文件内容
  ↓
再回答用户
```

第一版课程里你手写的 agent loop，在这里由 `createReactAgent` 帮你实现。

## 5. 工具描述会影响调用效果

如果工具描述太模糊：

```text
读取东西
```

模型就不容易知道什么时候使用它。

更好的描述是：

```text
读取指定路径的文本文件内容。适合查看项目源码、配置和 Markdown 文档。
```

工具描述越清楚，agent 越容易做出正确选择。

## 6. 增加 listFilesTool

创建 `src/tools/list-files.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { readdir } from "node:fs/promises";
import { z } from "zod";

export const listFilesTool = tool(
  async ({ path }) => {
    const entries = await readdir(path, { withFileTypes: true });
    return entries
      .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name))
      .join("\n");
  },
  {
    name: "list_files",
    description: "列出指定目录下的文件和子目录。适合先了解项目结构。",
    schema: z.object({
      path: z.string().describe("要列出的目录路径"),
    }),
  },
);
```

更新 `src/tools/index.ts`：

```ts
import { listFilesTool } from "./list-files";
import { readFileTool } from "./read-file";

export const tools = [listFilesTool, readFileTool];
```

## 7. 本章验收

完成后，你应该能：

- 使用 `createReactAgent` 创建工具智能体。
- 让模型自主选择工具。
- 理解 ReAct 和手写 agent loop 的关系。
- 添加多个工具并交给 agent 使用。

下一章会进入 LangGraph 状态图，学习如何构建更可控的复杂 agent。
