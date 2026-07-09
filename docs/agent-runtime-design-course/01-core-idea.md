# 01. 核心设计思想

## 一句话总结

Agent Runtime 的核心思想是：

```text
Agent 不是一个对象，而是一套可配置子会话机制。
```

这句话非常重要。它决定了后续代码不应该围绕一个越来越大的 `Agent` 类展开，而应该围绕几类清晰的角色展开：

```text
定义：AgentDefinition
注册：AgentRegistry
调度：delegate_task / AgentTool
执行：AgentRuntime
上下文：ExecutionContext
工具：ToolResolver
生命周期：TaskManager
```

## 为什么不是一个 Agent 类

一个简单 demo 常常会这样写：

```text
Agent = model + tools + prompt + memory
```

这种设计短期很快，但后续会遇到问题：

```text
不同 agent 的工具权限不好控制
子 agent 和主 agent 的上下文容易混在一起
后台任务缺少生命周期管理
插件或项目自定义 agent 难以加载
prompt、模型、工具、权限耦合在一个类里
后续无法嵌入多个项目复用
```

更稳的设计是：

```text
AgentDefinition 只描述 agent
AgentRuntime 负责运行 agent
AgentRegistry 负责查找 agent
ToolResolver 负责裁剪工具
ExecutionContext 负责隔离上下文
```

## AgentDefinition 只是说明书

Agent 定义只回答这些问题：

```text
它叫什么？
它适合什么时候使用？
它的 system prompt 是什么？
它能用哪些工具？
它不能用哪些工具？
它使用继承模型还是指定模型？
它是否需要后台运行？
它最多执行多少轮？
```

它不应该直接执行任务，也不应该持有复杂运行状态。

示例：

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
};
```

## Runtime 才负责执行

`AgentRuntime` 的职责是把一个定义变成一次真实运行：

```text
读取 AgentDefinition
解析可用工具
构造 system prompt
创建独立 ExecutionContext
复用主模型执行循环
收集结果
记录 transcript
返回结构化输出
```

它不关心这个 agent 是内置的、文件加载的，还是后续插件提供的。

## 子 agent 是主 agent 派生出的子会话

主 agent 遇到复杂任务时，不应该把所有事情都塞进自己的上下文里。它可以通过一个工具派发子任务：

```text
delegate_task({
  subagent_type: "code-reviewer",
  prompt: "检查 edit_file 的并发写入风险"
})
```

这个调用会创建一个子会话：

```text
独立 messages
独立 agentId
独立工具列表
独立 readFileState
可选独立 memory scope
共享底层模型调用机制
```

所以子 agent 不是另一个完全不同的系统，而是主执行机制的一次受控派生。

## 最重要的三个原则

### 1. 定义和执行分离

不要让 agent 定义直接执行任务。定义只描述能力，执行交给 Runtime。

### 2. 子上下文复用主循环

不要给子 agent 重新实现一套模型循环。它应该复用主系统的模型调用、工具调用、错误处理、记忆和日志机制。

### 3. 工具权限显式收敛

不要让所有 agent 默认拥有全部工具。每个 agent 应该只拿到自己完成任务需要的工具。

## 对当前项目的意义

当前 `mini-agent-langchain` 已经有：

```text
LangChain createAgent
Model.invoke()
Memory checkpointer
read_file / write_file / edit_file / list_files / search_text
读后写保护
CLI 会话
```

这说明第一阶段不需要从零开始。真正要做的是把这些能力从“主 agent 私有能力”抽象成 Runtime 能力：

```text
当前：一个 Model 内部固定创建一个 agent
目标：Runtime 根据 AgentDefinition 动态创建可控 agent
```

