# 04. Tools 与结构化输出

## 本章目标

第一版课程里，我们手写过 Tool：

```ts
type Tool = {
  name: string;
  description: string;
  schema: unknown;
  execute(input: unknown): Promise<string>;
};
```

本章要学习 LangChain.js 里的工具写法：

```ts
tool(async (input) => { ... }, {
  name,
  description,
  schema,
})
```

你会实现一个可以读取文件的 LangChain Tool。

## 1. 安装 zod

如果第 01 章已经执行过，这里不需要重复安装：

```bash
npm install zod
```

`zod` 用来描述工具参数结构。

## 2. 创建 readFileTool

创建 `src/tools/read-file.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { readFile } from "node:fs/promises";
import { z } from "zod";

export const readFileTool = tool(
  async ({ path }) => {
    return await readFile(path, "utf-8");
  },
  {
    name: "read_file",
    description: "读取指定路径的文本文件内容。适合查看项目源码、配置和 Markdown 文档。",
    schema: z.object({
      path: z.string().describe("要读取的文件路径"),
    }),
  },
);
```

## 3. 工具的三个核心字段

一个 LangChain Tool 通常包含：

- `name`：工具名称，模型会通过它选择工具。
- `description`：工具说明，影响模型什么时候调用它。
- `schema`：参数结构，告诉模型应该传什么参数。

这和第一版的工具系统完全对应。

## 4. 直接调用工具

创建 `src/index.ts`：

```ts
import { readFileTool } from "./tools/read-file";

const path = process.argv[2];

if (!path) {
  console.error("请输入文件路径");
  process.exit(1);
}

const content = await readFileTool.invoke({ path });
console.log(content);
```

运行：

```bash
npm run dev package.json
```

## 5. 工具错误处理

真实项目中，文件可能不存在。

可以先简单捕获错误：

```ts
export const readFileTool = tool(
  async ({ path }) => {
    try {
      return await readFile(path, "utf-8");
    } catch (error) {
      return `读取文件失败：${error instanceof Error ? error.message : String(error)}`;
    }
  },
  {
    name: "read_file",
    description: "读取指定路径的文本文件内容。适合查看项目源码、配置和 Markdown 文档。",
    schema: z.object({
      path: z.string().describe("要读取的文件路径"),
    }),
  },
);
```

这里选择返回错误文本，而不是直接抛出异常，是为了让 agent 可以把失败信息继续纳入推理上下文。

## 6. 结构化输出

除了工具参数，业务应用也经常需要模型输出结构化结果。

例如让模型输出任务分类：

```ts
import { z } from "zod";

export const taskSchema = z.object({
  type: z.enum(["question", "file_task", "command_task"]),
  reason: z.string(),
});
```

后续可以把它和模型的 structured output 能力结合，让模型稳定返回 JSON 结构。

## 7. 本章验收

完成后，你应该能：

- 用 `tool()` 创建 LangChain.js 工具。
- 用 `zod` 描述工具参数。
- 理解工具名称和描述对模型选择工具的影响。
- 直接调用工具进行调试。
- 为工具加入基础错误处理。

下一章会把工具交给 agent，让模型自己决定是否调用工具。
