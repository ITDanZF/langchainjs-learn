# LanceDB 系列教程

本系列以 LanceDB 的 TypeScript / Node.js SDK 和本地嵌入式数据库为主，循序介绍建表、检索、索引与 RAG。使用 `tsx` 运行示例：基础示例安装 `@lancedb/lancedb`，显式模式另需 `apache-arrow`，最后一篇需 `@huggingface/transformers` 下载本地 embedding 模型。本系列不要求 LanceDB Enterprise、API 密钥或聊天模型服务。

| 顺序 | 教程 | 核心问题 |
| --- | --- | --- |
| 01 | [本地入门与向量检索](01_本地入门与向量检索.md) | 如何建表并查询最近邻？ |
| 02 | [表结构与数据维护](02_表结构与数据维护.md) | 如何显式建模式、追加、更新与查看版本？ |
| 03 | [过滤、距离与索引](03_过滤距离与索引.md) | 什么时候用预过滤和 ANN？ |
| 04 | [全文与混合检索](04_全文与混合检索.md) | 如何结合关键词与向量排名？ |
| 05 | [LanceDB 与 RAG 实战](05_LanceDB与RAG实战.md) | 如何用真实 embedding 检索并拼接证据？ |

建议从 01 起依次阅读。01、02、04 和 05 各有独立的完整 TS 脚本；03 的第一个片段依赖 01 已建立的表，后续索引片段仅为较大数据集的配置示意。脚本的数据库路径相对于运行命令的当前工作目录，运行示例会覆盖各自的同名教学表，**不要在生产表上执行**。

资料依据 LanceDB 与 Transformers.js 官方文档，于 2026-09-15 核对。五篇完整 TS 示例已用 `@lancedb/lancedb@0.38.0` 严格类型检查并在临时目录运行，第 05 篇使用 `@huggingface/transformers@4.2.0`；03 的索引配置片段仅做类型检查，未在小样本表上建 ANN 索引。SDK 更新时以文末链接和已安装版本为准。各篇示例应在隔离的练习目录运行，避免修改仓库已有项目依赖。

官方入口：[LanceDB Quickstart](https://docs.lancedb.com/quickstart)、[Tables](https://docs.lancedb.com/tables/create)、[Search](https://docs.lancedb.com/search/vector-search)。