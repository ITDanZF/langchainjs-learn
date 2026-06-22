# 18. 多 Agent 协作：Planner、Executor、Reviewer

## 本章目标

第 13 章有了规划器，第 15 章有了补丁工作流。本章把这些角色拆开，形成 Planner、Executor、Reviewer 协作。

单 Agent 能完成很多任务，但复杂企业任务更适合拆成多个角色。

本章实现三角色协作：

```text
Planner  →  Executor  →  Reviewer
规划       执行工具       审查结果
```

## 1. 为什么需要多 Agent

单 Agent 的问题：

- 既规划又执行，容易边做边忘。
- 自己检查自己，容易放过错误。
- Prompt 越写越长，职责混乱。

多 Agent 的优势：

- 职责单一。
- 可独立评估。
- 可替换模型。
- 更容易加入审批点。

## 2. 角色定义

### Planner

职责：

- 理解任务。
- 拆步骤。
- 标记风险。
- 给出完成标准。

### Executor

职责：

- 根据计划调用工具。
- 记录执行结果。
- 遇到阻塞及时返回。

### Reviewer

职责：

- 检查答案是否满足任务。
- 检查是否有依据。
- 检查是否违反安全规则。
- 给出最终报告或要求重做。

## 3. Graph 结构

```text
START
  ↓
planner
  ↓
executor
  ↓
reviewer
  ↓
review_passed?
  ├─ yes → END
  └─ no  → executor
```

注意要限制最大迭代次数，避免无限循环。

## 4. 状态结构

```ts
const MultiAgentState = Annotation.Root({
  task: Annotation<string>(),
  plan: Annotation<TaskPlan | undefined>(),
  executionNotes: Annotation<string[]>({
    reducer: (current, update) => current.concat(update),
    default: () => [],
  }),
  review: Annotation<{ passed: boolean; feedback: string } | undefined>(),
  iteration: Annotation<number>({
    reducer: (_, update) => update,
    default: () => 0,
  }),
});
```

## 5. Reviewer 输出 Schema

```ts
const ReviewSchema = z.object({
  passed: z.boolean(),
  feedback: z.string(),
  missingEvidence: z.array(z.string()),
  safetyIssues: z.array(z.string()),
});
```

Reviewer 必须结构化输出，方便 Graph 决定下一步。

## 6. 验收

```bash
mini-agent run --team "分析当前项目是否可以发布，并给出发布前阻塞项"
```

期望：

- Planner 先给计划。
- Executor 检查文件和脚本。
- Reviewer 审查是否有证据。
- 最终答案包含阻塞项和依据。

## 7. 企业级思考

多 Agent 不要滥用。只有当任务确实复杂、需要审查或长流程时才引入。

下一章会把 CLI 能力服务化，方便接入 Web 和企业系统。
