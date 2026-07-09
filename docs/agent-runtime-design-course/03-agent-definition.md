# 03. AgentDefinition 设计

`AgentDefinition` 是整套系统的起点。它决定 agent 如何被声明、加载、展示和执行。

## 设计目标

`AgentDefinition` 应满足：

```text
可序列化
可从 markdown / JSON / 代码中创建
不持有运行状态
不直接执行任务
可以表达工具权限
可以表达模型选择
可以表达使用场景
```

## 第一阶段类型

建议先定义最小类型：

```ts
export type AgentDefinition = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[];
  disallowedTools?: string[];
  model?: "inherit" | string;
  maxTurns?: number;
  metadata?: Record<string, unknown>;
};
```

字段说明：

| 字段 | 含义 |
| --- | --- |
| `id` | 唯一标识，也是 `delegate_task.subagent_type` |
| `name` | 展示名称 |
| `description` | 什么时候应该使用这个 agent |
| `systemPrompt` | 子 agent 的系统提示词 |
| `tools` | 工具白名单 |
| `disallowedTools` | 工具黑名单 |
| `model` | 使用继承模型或指定模型 |
| `maxTurns` | 最大执行轮数 |
| `metadata` | 扩展信息 |

## 为什么需要 description

`description` 不是普通注释。它会进入主 agent 看到的工具说明中，帮助模型决定什么时候调用某个子 agent。

好的 description：

```text
Use this agent to review code changes, identify bugs, regressions, missing tests, and unsafe edits.
```

差的 description：

```text
This is a code agent.
```

description 应该回答：

```text
什么时候用它？
它擅长什么？
它不应该做什么？
```

## 内置 agent 示例

第一阶段可以先写在代码里：

```ts
export const builtInAgents: AgentDefinition[] = [
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description:
      "Use this agent to review code changes, find bugs, regressions, risk, and missing tests.",
    tools: ["read_file", "list_files", "search_text"],
    systemPrompt: [
      "You are a code review agent.",
      "Focus on bugs, regressions, missing tests, and risky behavior.",
      "Do not edit files.",
      "Return findings with file paths and concrete reasoning.",
    ].join("\n"),
  },
  {
    id: "file-editor",
    name: "File Editor",
    description:
      "Use this agent to make focused text edits after reading the relevant files.",
    tools: ["read_file", "edit_file", "write_file", "search_text"],
    systemPrompt: [
      "You are a focused editing agent.",
      "Make minimal, targeted edits.",
      "Read files before modifying them.",
      "Explain what changed after editing.",
    ].join("\n"),
  },
  {
    id: "code-searcher",
    name: "Code Searcher",
    description:
      "Use this agent to explore the codebase and locate relevant files, symbols, and flows.",
    tools: ["list_files", "search_text", "read_file"],
    systemPrompt: [
      "You are a code search agent.",
      "Find relevant files and summarize how the code is organized.",
      "Do not edit files.",
    ].join("\n"),
  },
];
```

## 后续 markdown agent 格式

等内置定义跑通后，可以支持项目级 markdown agent：

```markdown
---
id: code-reviewer
name: Code Reviewer
description: Review code changes and find bugs, regressions, and missing tests.
tools:
  - read_file
  - list_files
  - search_text
model: inherit
maxTurns: 6
---

You are a code review agent.

Focus on:
- correctness
- regressions
- missing tests
- unsafe file edits
```

建议路径：

```text
mini-agent-langchain/.agents/*.md
```

不要一开始就做用户级、全局级、插件级。先把项目级做好。

## 定义校验

加载 agent 时必须校验：

```text
id 不能为空
id 只能包含小写字母、数字、短横线、下划线
description 不能为空
systemPrompt 不能为空
tools 必须是已注册工具名
disallowedTools 必须是已注册工具名
maxTurns 必须是正整数
```

如果某个 agent 定义加载失败，不应该让整个程序启动失败。可以记录错误并跳过它。

## 覆盖规则

后续多来源加载时需要覆盖规则。建议顺序：

```text
built-in
project
user
plugin
runtime override
```

同名 `id` 后加载者覆盖前加载者。

第一阶段只需要：

```text
built-in
```

第二阶段增加：

```text
project
```

## 不要放进 AgentDefinition 的东西

不要在定义里放运行时对象：

```text
ChatOpenAI 实例
LangChain agent 实例
checkpointer 实例
readFileState
AbortController
session object
CLI view
```

这些都属于 Runtime 或 ExecutionContext。

定义应该可以安全地打印、保存、加载、传输。

