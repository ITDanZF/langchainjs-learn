# 02 高级 RAG：改写、混合检索与重排

## 1. “高级”体现在哪些地方？

高级 RAG 针对基础流程的薄弱环节进行优化，目标是让关键资料更容易被找到，让无关内容更少进入模型。

```text
优化文档与索引
      ↓
原问题 → 改写查询 → 召回候选 → 重排与过滤 → 整理上下文 → 回答
```

这些步骤按任务选择，不要求每个系统全部采用。混合检索和重排也能成为模块化系统的一部分，技术不是某种范式的专属标志。

## 2. 检索前：整理资料与明确查询

### 整理资料

假设同一个知识库包含现行 600 元标准和已失效的 400 元标准。查询当前政策时，需要检查有效期；查询历史政策时，则不能简单删掉所有旧资料。

可用的处理包括：保留标题与表格条件、为片段添加年份和地区、按适用范围过滤，以及让切块尽量保持规则完整。

### 改写查询

用户说“去上海住酒店一晚能报多少”，制度可能写“差旅住宿费用限额”。改写可以补充合适术语，但不能替用户猜测职级。

下面的 `model` 是支持结构化输出的聊天模型：

```python
from pydantic import BaseModel, Field

class SearchQuery(BaseModel):
    query: str = Field(description="保留已知条件的检索查询，不猜测缺失信息")

rewriter = model.with_structured_output(SearchQuery)
result = rewriter.invoke([
    ("system", "改写成清晰的检索查询，保留用户明确给出的职级、年份和城市。"),
    ("human", question),
])
search_query = result.query
```

`question` 保留原问题，`search_query` 只服务于检索。生成时仍应围绕原问题，避免查询改写改变任务含义。结构化输出保证的是结果形状，不保证查询内容一定合理。

官方参考：[ChatOpenAI 的结构化输出能力](https://docs.langchain.com/oss/python/integrations/chat/openai)。

## 3. 检索时：兼顾语义和精确词项

向量检索有利于识别“住酒店”与“住宿”的语义联系；BM25 能利用职级、产品编号等具体词项。中文 BM25 还需要合适的分词方式，不能直接假设文本以空格分词。

两路召回后需要合并、去重。常见的 RRF 按排名融合：

```text
片段的融合分数 = 各路中 1 / (常数 + 排名) 的总和
```

这种方式避免直接相加不同尺度的向量相似度与 BM25 分数。去重应依据稳定片段 ID，不能因为两段文字相似就误删不同版本的制度。

官方参考：[BM25 集成](https://docs.langchain.com/oss/python/integrations/retrievers/bm25)。

## 4. 检索后：重排究竟做什么？

第一次召回侧重从大量资料中快速找候选；重排则更细地判断候选与原问题的关系。

候选可能包括“P6 上海住宿标准”“P7 上海住宿标准”“上海交通费标准”。它们主题接近，但只有一部分能直接支持当前答案。

| 方式 | 判断方式 | 主要取舍 |
| --- | --- | --- |
| 向量相似度排序 | 比较分别编码的查询与文档向量 | 适合大范围召回 |
| Cross-Encoder 重排 | 联合读取每个问题与片段对并评分 | 计算更多，判断更细 |
| LLM 重排 | 让聊天模型阅读候选并判断证据价值 | 灵活，但增加调用与输出校验成本 |

例如先召回 20 个片段，再重排保留 5 个。这些数字只是示例，应通过数据验证。

下面是专用重排的接口片段，`cross_encoder` 表示已配置的评分模型，`candidates` 是已召回文档列表：

```python
from langchain_classic.retrievers.document_compressors import CrossEncoderReranker

reranker = CrossEncoderReranker(model=cross_encoder, top_n=5)
selected_docs = reranker.compress_documents(candidates, question)
```

这里特意使用 `langchain_classic`，因为该组件位于对应包中；它与后文 LangChain 1.x 的 `create_agent` 导入路径不同。具体模型适配参见 [官方 Cross-Encoder 教程](https://docs.langchain.com/oss/python/integrations/document_transformers/cross_encoder_reranker)。

重排只能处理已召回候选，不能补回根本未检索到的资料。

## 5. 上下文处理与补充检索

筛选后还可以去重、压缩和保留关键引用。压缩要保留适用条件与数字，不能把“仅限P7”删掉，只剩一个金额。

如果第一轮只查到“额度取决于职级”，可利用这一线索再查对应额度表。这是多跳检索的一种情况。多轮检索既能由预设规则控制，也能由 Agent 决定，存在循环不自动意味着 Agentic RAG。

## 6. 如何判断真的变好了？

固定同一批问题和语料，分别检查候选命中率、排序和最终回答。一次只改变主要因素，避免同时改分块、模型、语料和 K 后无法解释收益来源。

思考：如果准确率没变但模型调用翻倍，是否仍值得保留 LLM 重排？答案取决于任务要求，而不是“高级”这个名称。

下一篇：[03 模块化 RAG](03_模块化RAG_路由与多数据源.md)。
