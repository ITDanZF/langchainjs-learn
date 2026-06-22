# 08. 本地知识库 RAG：实现 mini-agent index

## 本章目标

本章让 `mini-agent-langchain` 能索引本地 Markdown 文档，并通过工具检索。

完成后可以运行：

```bash
npm run dev -- index docs
npm run dev -- run --graph "哪些文档讲了 Agent 工具系统？请带引用回答"
```

## 1. RAG 在企业 Agent 中的位置

文件工具适合用户知道路径的场景：

```text
读取 README.md
```

RAG 适合用户不知道路径，只描述语义需求的场景：

```text
找一下项目里关于权限控制的设计
```

企业知识库、制度文档、FAQ、工单手册都适合先用 RAG 接入。

## 2. 安装可选依赖

```bash
npm install @langchain/community hnswlib-node
```

如果本地安装 `hnswlib-node` 失败，可以先跳过向量库，用 `search_text` 作为关键词检索。企业实践中也可以替换为 pgvector、Milvus、Qdrant、Pinecone 等。

## 3. 文档加载器

创建 `src/rag/load-docs.ts`：

```ts
import { Document } from "@langchain/core/documents";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { resolveWorkspacePath, toWorkspaceRelativePath } from "../utils/workspace.js";

export async function loadMarkdownDocs(inputPath: string) {
  const root = resolveWorkspacePath(inputPath);
  const docs: Document[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".md")) continue;

      docs.push(
        new Document({
          pageContent: await readFile(fullPath, "utf8"),
          metadata: { source: toWorkspaceRelativePath(fullPath) },
        }),
      );
    }
  }

  await walk(root);
  return docs;
}
```

## 4. 文档切分

创建 `src/rag/split-docs.ts`：

```ts
import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function splitDocs(docs: Document[]) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 900,
    chunkOverlap: 150,
  });

  return splitter.splitDocuments(docs);
}
```

切分策略会影响召回质量。教程先用通用字符切分，后续可以按 Markdown 标题切分。

## 5. Embedding 模型封装

创建 `src/models/embedding.ts`：

```ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { env } from "../config/env.js";

export function createEmbeddingModel() {
  return new OpenAIEmbeddings({
    apiKey: env.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: env.DEEPSEEK_BASE_URL,
    },
  });
}
```

注意：并非所有 OpenAI 兼容服务都支持 embedding。如果你的供应商不支持，请换用支持 embedding 的模型服务。

## 6. 创建索引

创建 `src/rag/index-docs.ts`：

```ts
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { createEmbeddingModel } from "../models/embedding.js";
import { loadMarkdownDocs } from "./load-docs.js";
import { splitDocs } from "./split-docs.js";

export const RAG_INDEX_DIR = ".agent-index";

export async function indexDocs(inputPath: string) {
  const docs = await loadMarkdownDocs(inputPath);
  const chunks = await splitDocs(docs);
  const vectorStore = await HNSWLib.fromDocuments(chunks, createEmbeddingModel());

  await vectorStore.save(RAG_INDEX_DIR);

  return {
    docs: docs.length,
    chunks: chunks.length,
    indexDir: RAG_INDEX_DIR,
  };
}
```

## 7. CLI 接入 index

在 `src/cli.ts` 中添加：

```ts
import { indexDocs } from "./rag/index-docs.js";

program
  .command("index")
  .description("Index local markdown documents")
  .argument("<path>", "directory path")
  .action(async (path: string) => {
    const result = await indexDocs(path);
    console.log(`已索引 ${result.docs} 个文档，${result.chunks} 个片段`);
    console.log(`索引目录：${result.indexDir}`);
  });
```

## 8. search_docs 工具

创建 `src/tools/search-docs.ts`：

```ts
import { tool } from "@langchain/core/tools";
import { HNSWLib } from "@langchain/community/vectorstores/hnswlib";
import { z } from "zod";
import { createEmbeddingModel } from "../models/embedding.js";
import { RAG_INDEX_DIR } from "../rag/index-docs.js";

export const searchDocsTool = tool(
  async ({ query }) => {
    const vectorStore = await HNSWLib.load(RAG_INDEX_DIR, createEmbeddingModel());
    const docs = await vectorStore.similaritySearch(query, 4);

    return docs
      .map((doc, index) => [
        `#${index + 1} source=${doc.metadata.source}`,
        doc.pageContent.slice(0, 1000),
      ].join("\n"))
      .join("\n\n---\n\n");
  },
  {
    name: "search_docs",
    description: "从已索引的本地 Markdown 知识库中语义检索相关片段。回答文档类问题时优先使用。",
    schema: z.object({
      query: z.string().describe("检索问题或关键词"),
    }),
  },
);
```

把它加入 `src/tools/index.ts`：

```ts
import { searchDocsTool } from "./search-docs.js";

export const allTools = [
  ...filesystemTools,
  searchDocsTool,
];
```

## 9. Prompt 增加引用要求

在 `taskAgentPrompt` 中增加：

```text
如果使用 search_docs 工具，最终答案必须列出引用来源，格式为：
- 来源：docs/example.md
```

## 10. 验收

```bash
npm run dev -- index docs
npm run dev -- run --graph "总结 LangChain.js Agent 教程的学习路线，并列出引用来源"
```

## 11. 企业级思考

RAG 后续还要考虑：

- 增量索引。
- 文档权限过滤。
- 多租户隔离。
- 引用精确到标题或行号。
- 检索评估。
- 召回和重排。

下一章会加入命令执行工具，并重点处理权限策略。
