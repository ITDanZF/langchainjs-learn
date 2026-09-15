# 04 LanceDB 持久化检索

本篇将 LangChain.js 的 `OpenAIEmbeddings` 接到 LanceDB：文本进入 `embedDocuments`，问题进入 `embedQuery`，LanceDB 负责保存向量与查找近邻。文档先看 [01 的配置](01_配置与首次向量化.md) 和 [LanceDB TS 系列](../LanceDB/README.md)。

在练习目录执行 `npm install @lancedb/lancedb`。保存以下代码为 `lancedb.ts`，执行 `npx tsx lancedb.ts`（需要有效密钥和网络，可能计费）：

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";
import * as lancedb from "@lancedb/lancedb";

const apiKey = process.env.DASHSCOPE_API_KEY;
if (!apiKey) throw new Error("请先设置 DASHSCOPE_API_KEY");
const dimensions = 1024;
const embeddings = new OpenAIEmbeddings({
  apiKey,
  model: "text-embedding-v4",
  dimensions,
  batchSize: 10,
  configuration: { baseURL: process.env.DASHSCOPE_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1" },
});

const documents = [
  { id: "hotel", source: "差旅制度/住宿", text: "P6 员工在上海出差，住宿上限为每晚 600 元。" },
  { id: "train", source: "差旅制度/交通", text: "出差火车票凭有效票据报销。" },
  { id: "leave", source: "休假制度", text: "年假申请需要提前提交审批。" },
];
const vectors = await embeddings.embedDocuments(documents.map((doc) => doc.text));
if (vectors.some((vector) => vector.length !== dimensions)) throw new Error("向量维度错误");
const rows = documents.map((doc, index) => ({ ...doc, vector: vectors[index] }));

const db = await lancedb.connect("./policy-v4.lancedb");
const table = await db.createTable("policy_demo_v4_1024", rows, { mode: "overwrite" });
const question = "P6 在上海的酒店住宿上限是多少？";
const queryVector = await embeddings.embedQuery(question);
if (queryVector.length !== dimensions) throw new Error("查询维度错误");
const hits = await table.query().nearestTo(queryVector)
  .distanceType("cosine").select(["id", "source", "text", "_distance"])
  .limit(2).toArray();
console.log(hits.map(({ id, source, text, _distance }) => ({ id, source, text, _distance })));
```

数据库目录与表名只用于演示；`mode: "overwrite"` 每次运行都会清除同名表数据，绝不能对生产表照搬。持久化查询时使用 `await db.openTable("policy_demo_v4_1024")`，只需再次调用 `embedQuery`，无需重新对全部文档向量化。若改变模型、维度、文本清理或度量，先新建表并重新生成所有文档向量，避免新旧向量混用。

## 从命中到回答

拼接命中文本时连同 `source` 和 `id` 一起提供给已有聊天模型；证据不足时要求回答“不知道”，并核查制度版本、权限和适用条件。向量距离越小只是越接近，不等于答案有证据。多租户资料应在检索时预过滤，不应只靠生成提示隔离数据。条款编号等精确词可以评估全文检索与混合检索，但中文分词要先验证。

返回：[教程目录](README.md)。

参考：[百炼文本向量同步 API](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api)、[LangChain.js OpenAIEmbeddings](https://docs.langchain.com/oss/javascript/integrations/text_embedding/openai)、[LanceDB Vector Search](https://docs.lancedb.com/search/vector-search)。