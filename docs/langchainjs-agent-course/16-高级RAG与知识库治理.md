# 16. 高级 RAG：从本地索引到企业知识库治理

## 本章目标

第 08 章已经实现最小 RAG，第 12 章用它完成基础综合项目。本章不重做 RAG，而是把它升级成企业知识库治理能力。

第 08 章实现了最小 RAG。本章把它升级为企业知识库能力。

重点能力：

- 增量索引。
- 元数据过滤。
- 混合检索。
- 重排。
- 引用治理。
- 文档权限。

## 1. 基础 RAG 的问题

最小 RAG 通常会遇到：

- 文档更新后需要全量重建。
- 检索结果不稳定。
- 引用只到文件，不到章节。
- 不同用户看到不该看的文档。
- 相似度高但答案无关。

企业知识库必须治理这些问题。

## 2. 文档元数据

加载文档时记录更多 metadata：

```ts
metadata: {
  source: "docs/guide.md",
  title: "Agent 指南",
  section: "工具系统",
  updatedAt: "2026-06-22",
  owner: "platform-team",
  visibility: "internal",
}
```

检索时可以按 metadata 过滤：

```text
只检索 visibility=internal 且 owner=platform-team 的文档
```

## 3. 增量索引

记录每个文件的 hash：

```text
.agent-index/manifest.json
```

结构：

```json
{
  "docs/guide.md": {
    "hash": "abc123",
    "chunks": 12,
    "indexedAt": "2026-06-22T00:00:00.000Z"
  }
}
```

索引时只处理 hash 变化的文件。

## 4. Markdown 结构化切分

比字符切分更好的方式：

```text
# 一级标题
## 二级标题
### 三级标题
```

每个 chunk 保留标题路径：

```text
source=docs/guide.md
headingPath=Agent 指南 > 工具系统 > 权限
```

这样引用更准确。

## 5. 混合检索

企业知识库建议结合：

- 关键词检索：适合专有名词、错误码、API 名称。
- 向量检索：适合语义问题。
- 重排模型：对候选结果重新排序。

流程：

```text
query
 ├─ keyword search top 20
 ├─ vector search top 20
 └─ rerank top 5
```

## 6. 引用答案规范

RAG 回答必须带引用：

```text
## 结论
...

## 引用
- docs/langchainjs-agent-course/04-Tools与结构化输出.md：工具系统
- docs/langchainjs-agent-course/09-多工具业务助手.md：权限策略
```

没有引用就不能声称来自知识库。

## 7. 权限过滤

如果企业知识库接入用户体系，检索前必须知道：

- 当前用户是谁。
- 属于哪个部门。
- 能访问哪些空间。
- 文档是否有密级。

权限过滤应该发生在检索层，而不是回答后再过滤。

## 8. 评估 RAG

RAG 评估至少包含：

- 召回是否包含正确文档。
- 答案是否忠于引用。
- 是否拒绝回答无来源问题。
- 引用是否准确。

## 9. 验收

```bash
mini-agent index docs --incremental
mini-agent run --graph "找出教程中所有和权限相关的内容，并按来源归类"
```

期望输出按来源分组，而不是混成一段泛泛总结。

## 10. 企业级思考

高级 RAG 是企业 Agent 的核心。很多 Agent 失败并不是模型不行，而是知识库治理不行。

下一章会加入多模型路由，让不同任务用不同成本和能力的模型。
