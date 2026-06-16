# 06. LangGraph 状态图与可控循环

## 本章目标

`createReactAgent` 很适合快速实现工具 agent，但复杂业务经常需要更强的控制能力。

例如：

- 先分类任务，再决定走哪个流程。
- 某些工具调用前必须审批。
- 检索失败后换策略。
- 多个节点协作处理一个任务。
- 每一步都要记录状态。

这时就需要 LangGraph.js。

本章会学习：

```text
StateGraph
Node
Edge
Conditional Edge
```

## 1. LangGraph 是什么

LangGraph.js 是 LangChain 生态中用于构建有状态 agent 和工作流的框架。

你可以把它理解成：

```text
可控的 agent 状态机
```

第一版课程里我们手写过：

```ts
while (!done) {
  const decision = await llm.complete(messages);
  const observation = await runTool(decision);
  messages.push(observation);
}
```

LangGraph 会把这种循环拆成明确节点：

```text
agent node
  ↓
tool node
  ↓
agent node
```

## 2. 定义状态

创建 `src/agents/graph-agent.ts`：

```ts
import { Annotation, StateGraph } from "@langchain/langgraph";
import { BaseMessage, HumanMessage } from "@langchain/core/messages";
import { chatModel } from "../models/chat";

const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
});
```

这里的 `messages` 就是图的状态。

每个节点都可以读取状态，也可以返回状态更新。

## 3. 创建模型节点

继续添加：

```ts
async function callModel(state: typeof AgentState.State) {
  const response = await chatModel.invoke(state.messages);

  return {
    messages: [response],
  };
}
```

这个节点做的事情很简单：

```text
读取 messages
调用模型
把 AI 回复追加到 messages
```

## 4. 创建图

```ts
export const graphAgent = new StateGraph(AgentState)
  .addNode("model", callModel)
  .addEdge("__start__", "model")
  .addEdge("model", "__end__")
  .compile();
```

这是最小图：

```text
start → model → end
```

## 5. 调用图

修改 `src/index.ts`：

```ts
import { HumanMessage } from "@langchain/core/messages";
import { graphAgent } from "./agents/graph-agent";

const input = process.argv.slice(2).join(" ").trim();

if (!input) {
  console.error("请输入问题");
  process.exit(1);
}

const result = await graphAgent.invoke({
  messages: [new HumanMessage(input)],
});

console.log(result.messages.at(-1)?.content);
```

## 6. 为什么不用 createReactAgent 就够了

`createReactAgent` 是快速预制件。

LangGraph 是底层编排能力。

当应用足够简单时，用 `createReactAgent` 更快。

当应用需要明确流程时，用 `StateGraph` 更稳：

```text
分类 → 检索 → 工具调用 → 人工审批 → 最终回答
```

## 7. 条件路由示例

后续可以加入条件边：

```ts
.addConditionalEdges("model", shouldContinue, {
  tools: "tools",
  end: "__end__",
})
```

含义是：

```text
模型回复后，判断是否继续调用工具。
如果需要工具，进入 tools 节点。
否则结束。
```

## 8. 本章验收

完成后，你应该能：

- 理解 LangGraph 是有状态工作流框架。
- 定义图状态。
- 编写一个模型节点。
- 创建最小 `StateGraph`。
- 理解预制 agent 和自定义图的区别。

下一章会加入检查点和多轮会话记忆。
