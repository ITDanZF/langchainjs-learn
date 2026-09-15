# 官方阅读来源

检索核对日期：2026-09-07。以下为本系列教程使用的 LangChain / LangGraph / LangSmith 官方 Python 资料。正文的企业案例、流程对照和讲解为教学归纳，未将官方示例原样复制为配套项目。

| 来源 | 适合阅读的内容 |
| --- | --- |
| [Retrieval](https://docs.langchain.com/oss/python/langchain/retrieval) | 检索组件、两步RAG、Agentic RAG与已有数据源 |
| [Semantic search](https://docs.langchain.com/oss/python/langchain/knowledge-base) | Document、分块、embedding与检索器 |
| [Vector stores](https://docs.langchain.com/oss/python/integrations/vectorstores) | 向量存储与检索接口 |
| [ChatOpenAI](https://docs.langchain.com/oss/python/integrations/chat/openai) | 聊天模型、工具绑定、结构化输出 |
| [OpenAIEmbeddings](https://docs.langchain.com/oss/python/integrations/embeddings/openai) | 文本向量模型接口 |
| [BM25](https://docs.langchain.com/oss/python/integrations/retrievers/bm25) | 稀疏检索与分词 |
| [Cross-encoder reranker](https://docs.langchain.com/oss/python/integrations/document_transformers/cross_encoder_reranker) | 专用模型重排与对应包路径 |
| [Agents](https://docs.langchain.com/oss/python/langchain/agents) | create_agent与工具调用循环 |
| [Structured output](https://docs.langchain.com/oss/python/langchain/structured-output) | 输出schema与结构化结果 |
| [Custom RAG agent](https://docs.langchain.com/oss/python/langgraph/agentic-rag) | 检索、资料评估、改写和生成 |
| [Graph API](https://docs.langchain.com/oss/python/langgraph/graph-api) | 状态、节点、边与条件分支 |
| [Use Graph API](https://docs.langchain.com/oss/python/langgraph/use-graph-api) | Python图操作与执行控制 |
| [Recursion limit](https://docs.langchain.com/oss/python/langgraph/errors/GRAPH_RECURSION_LIMIT) | 图执行步数限制 |
| [Subagents](https://docs.langchain.com/oss/python/langchain/multi-agent/subagents) | 主管调用子智能体的模式 |
| [Neo4j](https://docs.langchain.com/oss/python/integrations/graphs/neo4j_cypher) | 图数据库查询与生成整合 |
| [RAG evaluation](https://docs.langchain.com/langsmith/evaluate-rag-tutorial) | 检索、答案和证据评估 |
| [Persistence](https://docs.langchain.com/oss/python/langgraph/persistence) | 状态持久化与checkpoint |

前序概念资料：[Agentic RAG 中文综述](../RAG/10_Agentic_RAG_Survey_2025_中文翻译.md)、[RAG 范式演进知识总结](../RAG-learn/01_RAG范式演进知识总结.md)。

## 阅读版本时的注意点

正文主要使用 LangChain 1.x 的 `create_agent` 与 LangGraph 的 `StateGraph` 接口。部分传统检索组件位于 `langchain_classic`，例如文中展示的 `CrossEncoderReranker`；使用其他文章中的片段时，需要核对对应包与版本。

Python 片段用于解释接口与设计，不构成完整应用，也不代表已经验证某种真实模型的检索或回答效果。
