# 07. delegate_task 工具设计

`delegate_task` 是主 agent 调度子 agent 的入口。它对应 Claude Code 里的 `AgentTool`，但第一阶段可以做得更轻。

## 目标

让主 agent 可以这样调用：

```json
{
  "subagent_type": "code-reviewer",
  "description": "Review edit_file safety",
  "prompt": "检查 edit_file 是否存在并发写入或未读先写的风险。"
}
```

工具内部执行：

```text
查找 subagent_type
创建子 ExecutionContext
解析子 agent 工具
调用 AgentRuntime.run()
返回子 agent 的最终结果
```

## 工具 schema

建议第一阶段：

```ts
const delegateTaskSchema = z.object({
  subagent_type: z
    .string()
    .describe("The id of the subagent to run."),
  description: z
    .string()
    .describe("A short description of the delegated task."),
  prompt: z
    .string()
    .describe("The complete task prompt to send to the subagent."),
});
```

后续再扩展：

```text
run_in_background
model
max_turns
cwd
isolation
```

第一阶段不要加太多参数。

## 工具 description

`delegate_task` 的 description 应该包含可用子 agent 列表：

```text
Delegate a focused task to a specialized subagent.

Available subagents:
- code-reviewer: Review code changes and find bugs, regressions, and missing tests.
- code-searcher: Locate files, symbols, and code flows.
- file-editor: Make focused edits after reading files.
```

这个 description 最好由 `AgentRegistry` 动态生成。

## 返回格式

第一阶段返回纯文本即可，但建议文本结构稳定：

```text
Subagent completed.
agentId: agent_abc123
subagentType: code-reviewer

Result:
...
```

Runtime 内部可以先使用结构化结果：

```ts
type DelegateTaskResult = {
  status: "completed" | "failed";
  agentId: string;
  subagentType: string;
  result: string;
};
```

工具最终把它格式化为字符串给 LangChain。

## 防止递归失控

如果子 agent 也拿到了 `delegate_task`，它可能继续派生子 agent。

第一阶段建议：

```text
主 agent 可以使用 delegate_task
子 agent 默认不允许使用 delegate_task
```

除非某个 agent 明确声明：

```ts
tools: ["delegate_task", ...]
```

并且 Runtime 检查最大深度：

```text
maxDepth = 1
```

后续再支持 coordinator agent。

## 和工具权限的关系

`delegate_task` 本身也是一个工具。

主 agent 工具：

```text
read_file
list_files
search_text
delegate_task
```

子 agent 工具根据定义裁剪。

注意：

```text
主 agent 拥有 edit_file 不代表子 agent 自动拥有 edit_file
子 agent 的工具列表由自己的 AgentDefinition 决定
```

## 调用链

```text
main agent
  |
  | calls delegate_task
  v
delegateTaskTool
  |
  | validates input
  | finds AgentDefinition
  v
AgentRuntime.run()
  |
  | creates ExecutionContext
  | resolves tools
  | invokes ModelRunner
  v
subagent result
  |
  v
main agent continues
```

## 错误处理

未知子 agent：

```text
Unknown subagent_type "tester".
Available subagents: code-reviewer, code-searcher, file-editor.
```

子 agent 执行失败：

```text
Subagent failed.
agentId: agent_abc123
subagentType: code-reviewer
error: ...
```

prompt 过短：

```text
The delegated prompt is too short. Provide a complete task with scope and expected output.
```

## 什么时候应该调用子 agent

主 agent 应该在这些场景调用：

```text
需要大量搜索
需要专门审查
需要隔离分析
需要把复杂任务拆成小任务
需要让另一个 prompt 视角检查结果
```

不应该调用：

```text
简单问答
用户明确要求主 agent 直接回答
只需要读一个文件
任务没有清晰边界
```

这部分可以写进主 agent system prompt。

