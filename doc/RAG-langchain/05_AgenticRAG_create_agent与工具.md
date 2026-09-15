# 05 Agentic RAG：create_agent 与工具

## 1. 从预设流程到运行时决策

传统流程可以预先规定“先检索，再回答”。Agentic RAG 让智能体根据当前任务和中间结果决定是否检索、调用什么工具，以及是否需要继续获取证据。

例如，系统先查 E001 的职级，得到 P6 后，再用“P6 上海 住宿额度”搜索制度。第二步的参数来自第一步结果。

```text
用户问题 → 模型判断 → 工具调用 → 结果返回模型
                         ↑              ↓
                         └─ 继续查询 ───┤
                                        └─ 生成答案
```

一个智能体就能实现这类流程，多智能体不是必要条件。

## 2. LangChain 已经提供了什么？

Python 的 `create_agent` 提供常见模型与工具循环，底层运行机制建立在 LangGraph 上。开发者需要定义模型、工具和任务约束，模型负责在允许的能力范围内作出决策。[官方 Agents 文档](https://docs.langchain.com/oss/python/langchain/agents)

这里没有一个万能的“开启 Agentic RAG”开关。知识库如何建立、工具怎样查询、证据何时足够，仍取决于具体设计。

## 3. 将检索器声明成工具

下面的 `retriever` 表示已经配置好的制度检索器：

```python
from langchain.tools import tool

@tool
def search_policies(query: str) -> str:
    """查询企业现行差旅制度；查询中应包含已知职级和出差城市。"""
    docs = retriever.invoke(query)
    return "\n\n".join(
        f"来源：{doc.metadata['source']}\n{doc.page_content}"
        for doc in docs
    )
```

函数名、描述和参数类型帮助模型理解工具用途。函数体才执行实际检索。模型输出一个工具名称并不代表数据已经被查到，必须执行函数并把结果返回模型。

同样可以定义 `get_employee(employee_id)` 和 `get_claim(claim_id)`，分别连接员工数据和报销单数据。每个工具应明确接受什么参数、返回什么事实、查不到时如何表达。

## 4. 创建与调用智能体

下面的 `model` 表示支持工具调用的聊天模型；`get_employee`、`get_claim` 表示上述业务查询工具：

```python
from langchain.agents import create_agent

agent = create_agent(
    model=model,
    tools=[search_policies, get_employee, get_claim],
    system_prompt=(
        "你是企业报销助手。企业事实必须查询工具并注明来源。"
        "根据已有证据决定是否继续查询；缺少必要条件时说明缺口，不猜测。"
    ),
)

result = agent.invoke(
    {"messages": [{"role": "user", "content": "E001去上海住宿最多报销多少？"}]},
    config={"recursion_limit": 24},
)
```

这是接口组合示意，工具的数据实现由业务决定。`recursion_limit` 限制图执行步数，不等于最多 24 次检索，也不是 token 或费用预算。

## 5. 调用过程中发生了什么？

一次合理的交互可能是：

| 步骤 | 行为 | 得到的信息 |
| --- | --- | --- |
| 1 | 调用 `get_employee(E001)` | 员工职级为 P6 |
| 2 | 调用 `search_policies(...)` | P6 到上海的现行额度 |
| 3 | 整合两个来源 | 每晚上限 600 元，并注明适用条件 |

模型响应中的 `tool_calls` 描述待调用工具及参数。工具执行完成后，结果以工具消息返回，模型才继续判断。这里形成了根据证据调整行动的循环。

顺序不必完全固定。模型也可能先查制度再查员工，评估重点应是来源是否完整、参数是否正确，而不是调用顺序是否与示例一模一样。

## 6. 使用 Agent 并没有消除哪些问题？

模型可能选择错误工具、猜测参数、反复检索或过早结束。工具描述和系统提示能帮助约束，但不能代替验证。

应观察中间调用，检查用户未提供城市时是否擅自补充，员工 ID 不存在时是否猜测职级，以及是否将检索内容中的无关指令当成任务要求。

需要更明确的评估、重试和停止逻辑时，可以直接用 LangGraph 定义控制流程。

下一篇：[06 LangGraph 纠错流程](06_LangGraph_评估改写与有限循环.md)。
