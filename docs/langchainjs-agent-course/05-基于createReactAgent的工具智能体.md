# 05. Agent 任务执行：实现 mini-agent run

## 本章目标

本章让模型自动选择工具，完成第一个真正的 Agent 命令：

```bash
npm run dev -- run "阅读 README.md 并总结项目"
```

你会新增：

```text
src/prompts/agent.ts
src/agents/task-agent.ts
```

你会安装：

```bash
npm install langchain
```

第 04 章已经完成工具定义，本章才把这些工具交给 Agent 使用。

## 1. ask 和 run 的区别

`ask` 是问答：

```text
用户输入 → 模型回答
```

`run` 是任务执行：

```text
用户任务 → 模型判断是否需要工具 → 调用工具 → 阅读工具结果 → 输出最终答案
```

企业级 Agent 的核心价值在 `run`，因为它能基于真实上下文行动。

## 2. Agent 系统提示词

创建 `src/prompts/agent.ts`：

```ts
export const taskAgentPrompt = `
你是 mini-agent-langchain 的企业级任务执行 Agent。

你可以使用工具读取工作区文件、列目录、搜索文本。

行为规则：
1. 如果用户要求分析本地项目、文件或目录，必须先调用工具获取真实信息。
2. 不要编造文件内容、目录结构或命令结果。
3. 工具结果不足时，说明限制，并建议下一步。
4. 最终回答要包含“结论”和“依据”。
5. 引用文件时使用相对路径。
`.trim();
```

## 3. 创建 Task Agent

创建 `src/agents/task-agent.ts`：

```ts
import { createAgent } from "langchain";
import { createChatModel } from "../models/chat.js";
import { taskAgentPrompt } from "../prompts/agent.js";
import { allTools } from "../tools/index.js";

export function createTaskAgent() {
  return createAgent({
    model: createChatModel(),
    tools: allTools,
    systemPrompt: taskAgentPrompt,
  });
}

export async function runTask(input: string) {
  const agent = createTaskAgent();

  const result = await agent.invoke({
    messages: [{ role: "user", content: input }],
  });

  const lastMessage = result.messages.at(-1);
  return lastMessage?.content ?? "";
}
```

说明：LangChain.js 新版推荐使用 `createAgent()` 构建工具调用 Agent。旧版资料中常见的 `createReactAgent()` 仍可见，但本课程以新的 `createAgent()` 思路为主。

## 4. 接入 CLI

修改 `src/main.ts` 的 `run` 命令：

```ts
import { runTask } from "./agents/task-agent.js";

program
  .command("run")
  .description("Run an agent task")
  .argument("<task...>", "task text")
  .action(async (task: string[]) => {
    const input = joinArgs(task);
    if (!ensureInput(input, "请输入任务")) return;

    const output = await runTask(input);
    console.log(output);
  });
```

## 5. 验收

```bash
npm run dev -- run "列出当前项目有哪些顶层文件，并说明它们的作用"
```

再试：

```bash
npm run dev -- run "阅读 package.json，说明这个项目有哪些脚本"
```

合格表现：

- Agent 会调用 `list_files` 或 `read_file`。
- 回答里不会编造不存在的脚本。
- 输出包含结论和依据。

## 6. 工具调用失败怎么办

工具可能失败，例如文件不存在。企业级 Agent 不能直接崩溃，应该：

- 把工具错误转化为模型可理解的信息。
- 告诉用户哪个路径失败。
- 给出下一步建议。

后续第 10 章会统一错误处理；本章先保持最小实现。

## 7. 为什么还需要 LangGraph

`createAgent()` 足够快速实现工具调用，但企业系统还需要：

- 执行命令前确认。
- 控制最大循环次数。
- 记录每个节点耗时。
- 在某个步骤中断和恢复。
- 对不同任务走不同分支。

这些能力会在下一章用 LangGraph 显式建模。

## 8. 本章小结

现在 `mini-agent run` 已经能调用工具完成本地项目任务。

下一章会把这个黑盒 Agent loop 拆成状态机，为安全、记忆和复杂工作流打基础。
