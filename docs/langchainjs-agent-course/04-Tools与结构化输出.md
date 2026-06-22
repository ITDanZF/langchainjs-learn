# 04. 工具系统：让 Agent 读取项目文件

## 本章目标

本章给 `mini-agent-langchain` 增加第一批工具。

完成后项目会新增：

```text
src/utils/workspace.ts
src/tools/list-files.ts
src/tools/read-file.ts
src/tools/search-text.ts
src/tools/index.ts
```

这些工具暂时还不会自动被模型调用，下一章会交给 Agent 使用。

## 1. 工具系统的企业级边界

工具不是随便写一个函数给模型调用。企业项目里，工具至少要明确：

- 工具名是否稳定。
- 工具描述是否清楚。
- 输入参数是否校验。
- 输出是否限制长度。
- 是否允许访问工作区外部。
- 出错时返回什么。

本章先实现本地文件工具，并强制限制在 `AGENT_WORKSPACE` 内。

## 2. 工作区路径工具

创建 `src/utils/workspace.ts`：

```ts
import path from "node:path";
import { env } from "../config/env.js";

export const workspaceRoot = path.resolve(env.AGENT_WORKSPACE);

export function resolveWorkspacePath(inputPath: string) {
  const resolvedPath = path.resolve(workspaceRoot, inputPath);

  if (!resolvedPath.startsWith(workspaceRoot)) {
    throw new Error(`Path is outside workspace: ${inputPath}`);
  }

  return resolvedPath;
}

export function toWorkspaceRelativePath(fullPath: string) {
  return path.relative(workspaceRoot, fullPath);
}
```

这个模块以后所有文件工具都要使用，避免工具读取任意系统路径。

## 3. list_files 工具

创建 `src/tools/list-files.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { readdir } from "node:fs/promises";
import { z } from "zod";
import { resolveWorkspacePath } from "../utils/workspace.js";

export const listFilesTool = tool(
  async ({ path }) => {
    const dir = resolveWorkspacePath(path);
    const entries = await readdir(dir, { withFileTypes: true });

    return entries
      .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`)
      .join("\n");
  },
  {
    name: "list_files",
    description: "列出工作区内某个目录的文件和子目录。适合了解项目结构。",
    schema: z.object({
      path: z.string().default(".").describe("相对工作区的目录路径"),
    }),
  },
);
```

## 4. read_file 工具

创建 `src/tools/read-file.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { resolveWorkspacePath } from "../utils/workspace.js";

const MAX_FILE_CHARS = 12000;

export const readFileTool = tool(
  async ({ path }) => {
    const file = resolveWorkspacePath(path);
    const content = await readFile(file, "utf8");

    if (content.length <= MAX_FILE_CHARS) return content;

    return [
      content.slice(0, MAX_FILE_CHARS),
      `\n[内容已截断：原始长度 ${content.length} 字符]`,
    ].join("");
  },
  {
    name: "read_file",
    description: "读取工作区内文本文件内容。适合查看 Markdown、TypeScript、JSON、配置文件。",
    schema: z.object({
      path: z.string().describe("相对工作区的文件路径"),
    }),
  },
);
```

企业级项目必须限制工具输出长度，否则容易把上下文窗口塞满。

## 5. search_text 工具

创建 `src/tools/search-text.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveWorkspacePath, toWorkspaceRelativePath } from "../utils/workspace.js";

const ignoredDirs = new Set(["node_modules", ".git", "dist", ".agent-index"]);

export const searchTextTool = tool(
  async ({ query, path: inputPath }) => {
    const root = resolveWorkspacePath(inputPath);
    const results: string[] = [];

    async function walk(dir: string) {
      const entries = await readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoredDirs.has(entry.name)) await walk(fullPath);
          continue;
        }

        const content = await readFile(fullPath, "utf8").catch(() => "");
        const lines = content.split("\n");

        lines.forEach((line, index) => {
          if (line.includes(query)) {
            results.push(`${toWorkspaceRelativePath(fullPath)}:${index + 1}: ${line.trim()}`);
          }
        });
      }
    }

    await walk(root);

    return results.slice(0, 50).join("\n") || "No matches found";
  },
  {
    name: "search_text",
    description: "在工作区内搜索文本，返回文件路径、行号和匹配行。适合定位代码和文档。",
    schema: z.object({
      query: z.string().describe("要搜索的关键词"),
      path: z.string().default(".").describe("相对工作区的搜索目录"),
    }),
  },
);
```

## 6. 工具集合

创建 `src/tools/index.ts`：

```ts
import { listFilesTool } from "./list-files.js";
import { readFileTool } from "./read-file.js";
import { searchTextTool } from "./search-text.js";

export const filesystemTools = [listFilesTool, readFileTool, searchTextTool];
export const allTools = [...filesystemTools];
```

以后新增工具只改这里，Agent 不需要关心工具文件分布。

## 7. 工具命名规范

建议使用稳定的蛇形命名：

```text
list_files
read_file
search_text
search_docs
run_command
query_ticket
```

不要频繁改工具名。工具名一旦进入 Prompt、评估用例、日志和监控，就属于接口。

## 8. 验收思路

本章主要是新增工具模块。你可以先不直接运行工具，下一章通过 Agent 验收：

```bash
npm run dev -- run "列出当前项目文件"
```

## 9. 企业级思考

当前工具仍然是教学版，后续可以增强：

- 文件类型白名单。
- 最大递归深度。
- 搜索超时。
- 二进制文件跳过。
- 统一工具错误格式。
- 工具调用审计日志。

下一章会把工具交给 LangChain.js Agent，完成 `mini-agent run`。
