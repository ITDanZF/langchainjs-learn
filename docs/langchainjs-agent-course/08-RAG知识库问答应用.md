# 08. RAG 知识库问答应用

## 本章目标

RAG 是 Retrieval-Augmented Generation，也就是检索增强生成。

它解决的问题是：

```text
模型不知道你的私有文档
  ↓
先检索相关文档
  ↓
把文档片段放进上下文
  ↓
再让模型回答
```

本章会实现一个基于本地 Markdown 文档的问答应用。

## 1. RAG 的基本流程

```text
文档加载
  ↓
文本切分
  ↓
向量化
  ↓
存入向量库
  ↓
用户提问
  ↓
检索相关片段
  ↓
模型基于片段回答
```

## 2. 安装依赖

```bash
npm install @langchain/community hnswlib-node
```

如果你在 Windows 上安装 `hnswlib-node` 遇到编译问题，可以先换用内存向量库学习流程，后续再切换生产级存储。

## 3. 加载 Markdown 文档

创建 `src/rag/loader.ts`：

```ts
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { Document } from "@langchain/core/documents";

export async function loadMarkdownDocs(dir: string): Promise<Document[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const docs: Document[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const path = join(dir, entry.name);
    const content = await readFile(path, "utf-8");

    docs.push(
      new Document({
        pageContent: content,
        metadata: { path },
      }),
    );
  }

  return docs;
}
```

## 4. 文本切分

创建 `src/rag/splitter.ts`：

```ts
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import type { Document } from "@langchain/core/documents";

export async function splitDocs(docs: Document[]) {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 800,
    chunkOverlap: 120,
  });

  return await splitter.splitDocuments(docs);
}
```

## 5. 向量检索

创建 `src/rag/retriever.ts`：

```ts
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { config } from "../config";
import { loadMarkdownDocs } from "./loader";
import { splitDocs } from "./splitter";

export async function createMarkdownRetriever(dir: string) {
  const docs = await loadMarkdownDocs(dir);
  const chunks = await splitDocs(docs);

  const embeddings = new OpenAIEmbeddings({
    apiKey: config.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: "https://api.deepseek.com",
    },
  });

  const vectorStore = await MemoryVectorStore.fromDocuments(chunks, embeddings);

  return vectorStore.asRetriever(4);
}
```

注意：实际使用时要确认你的模型供应商是否提供兼容的 embeddings 接口。DeepSeek Chat API 和 Embeddings API 不是一回事。如果 embeddings 不可用，可以换成 OpenAI、DashScope、硅基流动或本地 embedding 服务。

## 6. RAG Chain

创建 `src/chains/rag-chain.ts`：

```ts
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { RunnablePassthrough, RunnableSequence } from "@langchain/core/runnables";
import { chatModel } from "../models/chat";
import { createMarkdownRetriever } from "../rag/retriever";

function formatDocs(docs: Array<{ pageContent: string }>) {
  return docs.map((doc) => doc.pageContent).join("\n\n---\n\n");
}

export async function createRagChain(dir: string) {
  const retriever = await createMarkdownRetriever(dir);

  const prompt = ChatPromptTemplate.fromMessages([
    ["system", "你只能基于给定上下文回答。如果上下文不足，请说明不知道。"],
    ["human", "上下文：\n{context}\n\n问题：{question}"],
  ]);

  return RunnableSequence.from([
    {
      context: retriever.pipe(formatDocs),
      question: new RunnablePassthrough(),
    },
    prompt,
    chatModel,
    new StringOutputParser(),
  ]);
}
```

## 7. 调用 RAG

修改 `src/index.ts`：

```ts
import { createRagChain } from "./chains/rag-chain";

const question = process.argv.slice(2).join(" ").trim();

if (!question) {
  console.error("请输入问题");
  process.exit(1);
}

const chain = await createRagChain("../docs/nodejs-agent-course");
const answer = await chain.invoke(question);

console.log(answer);
```

## 8. 本章验收

完成后，你应该能：

- 解释 RAG 的完整流程。
- 加载本地 Markdown 文档。
- 使用文本切分器切分文档。
- 创建向量检索器。
- 把检索结果放入 Prompt。
- 构建一个文档问答应用。

下一章会把 RAG、文件工具、命令工具和业务 API 组合成多工具业务助手。
