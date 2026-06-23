# 06. LangGraph 状态机：显式控制 Agent 循环

## 本章目标

本章引入 LangGraph，把 Agent 执行过程从“框架内部循环”变成“项目可控状态机”。

你会新增：

```text
src/graph/task-graph.ts
```

你会安装：

```bash
npm install @langchain/langgraph
```

完成后可以运行：

```bash
npm run dev -- run --graph "搜索项目里和 env 有关的代码"
```

## 1. 企业 Agent 为什么需要状态机

简单 Agent 可以自动调用工具，但企业任务通常需要控制点：

- 工具调用前检查权限。
- 命令执行前请求确认。
- 工具失败时走错误分支。
- 长任务支持中断和恢复。
- 每一步都要记录审计日志。

这些需求不适合藏在一个黑盒循环里，应该用状态图表达。

## 2. 状态机结构

本章先实现最小图：

```text
START
  ↓
agent 节点：模型生成回复或工具调用
  ↓
是否有工具调用？
  ├─ 是 → tools 节点 → agent 节点
  └─ 否 → END
```

这就是显式版 Agent loop。

## 3. 创建 Graph

创建 `src/graph/task-graph.ts`：

```ts
import { Annotation, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { createChatModel } from "../models/chat.js";
import { taskAgentPrompt } from "../prompts/agent.js";
import { allTools } from "../tools/index.js";

const TaskState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
});

function shouldContinue(state: typeof TaskState.State) {
  const lastMessage = state.messages.at(-1);

  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    return "tools";
  }

  return "end";
}

export function createTaskGraph() {
  const model = createChatModel().bindTools(allTools);
  const toolNode = new ToolNode(allTools);
  const systemMessage = new SystemMessage(taskAgentPrompt);

  async function callModel(state: typeof TaskState.State) {
    const response = await model.invoke([systemMessage, ...state.messages]);
    return { messages: [response] };
  }

  return new StateGraph(TaskState)
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge("__start__", "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      end: "__end__",
    })
    .addEdge("tools", "agent")
    .compile();
}

export async function runGraphTask(input: string) {
  const graph = createTaskGraph();
  const result = await graph.invoke({
    messages: [new HumanMessage(input)],
  });

  return result.messages.at(-1)?.content ?? "";
}
```

## 4. CLI 增加 --graph

修改 `run` 命令：

```ts
import { runGraphTask } from "./graph/task-graph.js";

program
  .command("run")
  .description("Run an agent task")
  .argument("<task...>", "task text")
  .option("--graph", "use LangGraph runtime")
  .action(async (task: string[], options: { graph?: boolean }) => {
    const input = joinArgs(task);
    if (!ensureInput(input, "请输入任务")) return;

    const output = options.graph ? await runGraphTask(input) : await runTask(input);
    console.log(output);
  });
```

## 5. 验收

```bash
npm run dev -- run --graph "列出 src 目录，并说明每个子目录的职责"
```

如果输出基于真实目录结构，说明 graph → tool → graph 的循环跑通了。

## 6. 企业级扩展点

后续可以在图里增加节点：

| 节点 | 作用 |
| --- | --- |
| `plan` | 先生成任务计划 |
| `approval` | 高风险操作前请求确认 |
| `summarize` | 压缩过长工具结果 |
| `retry` | 工具失败后重试 |
| `audit` | 写入审计日志 |

## 7. 本章小结

现在你已经有两种运行时：

- `createAgent()`：快速、简洁。
- `LangGraph`：可控、可扩展、适合企业复杂流程。

下一章会在 LangGraph 上加入会话记忆，实现交互式 `chat`。
