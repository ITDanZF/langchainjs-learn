# 08. Memory、Task 与 Transcript 设计

这三个能力不一定要第一阶段全部实现，但需要提前设计好方向。

## 三者的区别

```text
Memory：跨调用保留的对话或知识状态
Task：一次可管理的运行生命周期
Transcript：一次运行的完整过程记录
```

不要混淆它们：

```text
memory 不是日志
transcript 不是长期记忆
task 不是模型上下文
```

## Memory

当前项目已经使用 LangChain checkpointer。

第一阶段建议：

```text
主 agent 使用当前 threadId
子 agent 使用派生 threadId
```

示例：

```text
main thread:
  default

subagent thread:
  default/subagent/code-reviewer/agent_abc123
```

这样子 agent 的消息不会污染主会话。

## Memory scope

后续可以支持：

```text
none
thread
project
user
```

第一阶段只做：

```text
thread
```

即每次子 agent 拥有自己的 thread 记忆。

## Transcript

Transcript 记录一次 agent 运行的完整过程，适合调试和回放。

建议保存：

```text
agentId
subagentType
parentAgentId
threadId
startedAt
endedAt
input prompt
system prompt hash
tool list
messages
final result
error
```

第一阶段可以先不落盘，只在 Runtime 返回中保留关键字段。

第二阶段落盘：

```text
.agent-runtime/transcripts/<agentId>.json
```

## 为什么需要 Transcript

没有 transcript 时，很难回答：

```text
子 agent 为什么这么改？
它读过哪些文件？
它调用过哪些工具？
它失败在哪一步？
它的 system prompt 是什么？
```

当系统作为可嵌入 Runtime 时，transcript 是排查问题的核心资料。

## Task

Task 管理的是运行生命周期。

同步任务：

```text
创建 task
运行
完成
返回结果
```

后台任务：

```text
创建 task
立即返回 taskId
后台运行
记录进度
完成后通知
用户读取 outputFile
```

第一阶段只做同步，不做后台。

## Task 状态

后续可以设计：

```ts
type AgentTaskStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";
```

Task 数据：

```ts
type AgentTask = {
  taskId: string;
  agentId: string;
  subagentType: string;
  description: string;
  status: AgentTaskStatus;
  startedAt: Date;
  endedAt?: Date;
  outputFile?: string;
  error?: string;
};
```

## 后台任务什么时候需要

适合后台：

```text
全项目扫描
长时间测试
复杂重构分析
多 agent 并行分析
生成大型报告
```

不适合后台：

```text
一次文件读取
简单搜索
简短审查
用户期待立即回答
```

## 第一阶段保留接口

即使第一阶段不做后台，也可以让返回值预留状态：

```ts
type RunAgentResult =
  | {
      status: "completed";
      agentId: string;
      result: string;
    }
  | {
      status: "failed";
      agentId: string;
      error: string;
    };
```

未来扩展：

```ts
  | {
      status: "running";
      agentId: string;
      taskId: string;
      outputFile?: string;
    };
```

## 存储目录建议

后续可以使用：

```text
.agent-runtime/
  transcripts/
  tasks/
  memory/
```

不要把运行产物放进 `docs` 或 `src`。

这些目录通常应加入 `.gitignore`。

