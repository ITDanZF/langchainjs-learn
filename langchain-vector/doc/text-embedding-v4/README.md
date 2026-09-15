# text-embedding-v4：LangChain.js 教程

使用 TypeScript 的 `@langchain/openai` / `OpenAIEmbeddings` 调用阿里云百炼 **OpenAI 兼容**接口。无需 OpenAI 密钥，需百炼 API Key 和匹配的兼容模式 Host。先按 [01](01_配置与首次向量化.md) 准备 Node.js 环境，再依序阅读：

| 篇目 | 学习重点 |
| --- | --- |
| [01 配置与首次向量化](01_配置与首次向量化.md) | 密钥、Host、`embedQuery` 与 `embedDocuments` |
| [02 批量、维度与成本](02_批量维度与成本.md) | 10 条请求限制、可选维度、长度与重试 |
| [03 相似度检索](03_相似度检索.md) | 向量排序与 Top-K 的边界 |
| [04 LanceDB 持久化检索](04_LanceDB持久化检索.md) | 生成文档向量、建表和查询近邻 |

01 至 04 的脚本需要有效 API Key，实际调用可能计费。示例均在独立目录运行，04 每次会覆盖其同名**教学表**。批量实时请求与阿里云异步 Batch 服务不是同一回事；代码不包含生成模型调用。2026-09-15 使用 `@langchain/openai@1.5.1`、`@langchain/core@1.2.0` 和 `@lancedb/lancedb@0.38.0` 做了严格 TS 类型检查；未提供 API Key，未执行付费请求或验证实际排序结果。使用前核对 [百炼同步 API](https://help.aliyun.com/zh/model-studio/text-embedding-synchronous-api) 的当前地域、模型限制与费用。