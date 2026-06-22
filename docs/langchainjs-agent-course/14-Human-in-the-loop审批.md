# 14. Human-in-the-loop：高风险操作审批

## 本章目标

第 13 章让 Agent 先规划复杂任务。本章继续解决规划之后的关键问题：计划里如果包含高风险动作，不能直接执行，必须进入人工审批。

前面 `run_command` 遇到高风险命令只返回 `APPROVAL_REQUIRED`。企业级 Agent 不能只提示，它应该进入明确的审批流程。

本章会新增：

```text
src/approval/approval.ts
src/graph/approval-node.ts
```

完成后目标体验：

```bash
mini-agent run --graph "安装 lodash 并说明为什么需要它"
```

CLI 应询问：

```text
Agent 请求执行：npm install lodash
是否允许？y/N
```

## 1. 为什么审批必须进入 Graph

审批不是普通工具能力，而是运行时控制能力。

错误做法：

```text
工具内部偷偷决定是否执行
```

更好的做法：

```text
Agent 产生高风险动作
  ↓
Graph 路由到 approval 节点
  ↓
用户确认
  ↓
继续执行或拒绝
```

这样审批可以被日志、审计、权限系统统一管理。

## 2. 审批请求结构

创建 `src/approval/approval.ts`：

```ts
export type ApprovalRequest = {
  id: string;
  action: string;
  command?: string;
  args?: string[];
  reason: string;
  risk: "medium" | "high";
};

export type ApprovalResult = {
  approved: boolean;
  reason?: string;
};
```

## 3. CLI 审批函数

```ts
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { ApprovalRequest, ApprovalResult } from "./approval.js";

export async function requestCliApproval(request: ApprovalRequest): Promise<ApprovalResult> {
  const rl = createInterface({ input, output });

  console.log("\n需要用户审批：");
  console.log(`动作：${request.action}`);
  console.log(`风险：${request.risk}`);
  console.log(`原因：${request.reason}`);
  if (request.command) console.log(`命令：${request.command} ${(request.args ?? []).join(" ")}`);

  const answer = (await rl.question("是否允许？y/N ")).trim().toLowerCase();
  rl.close();

  return { approved: answer === "y" || answer === "yes" };
}
```

## 4. Graph 中的审批节点

审批节点可以读取状态里的 `pendingApproval`：

```ts
async function approvalNode(state: typeof EnterpriseState.State) {
  if (!state.pendingApproval) return {};

  const result = await requestCliApproval(state.pendingApproval);

  return {
    approvalResult: result,
    pendingApproval: undefined,
  };
}
```

条件边：

```text
agent → needsApproval ? approval : tools
approval → approved ? tools : end
```

## 5. 命令工具如何配合

`run_command` 不应该直接问用户，而是返回结构化信号：

```text
APPROVAL_REQUIRED: npm install lodash
```

更好的企业版是工具调用前就在 Graph 中识别风险，不进入工具执行。

## 6. 审批日志

每次审批都应该记录：

- 谁发起。
- 请求执行什么。
- 风险等级。
- 用户是否批准。
- 时间戳。
- thread/task id。

这类日志属于审计日志，不应该只打印在终端。

## 7. 验收

```bash
mini-agent run --graph "执行 npm install lodash"
```

期望：

- Agent 不应直接安装。
- CLI 要求用户确认。
- 用户拒绝时，Agent 说明任务未执行。

## 8. 企业级思考

审批可以从 CLI 扩展到：

- Web 控制台审批。
- Slack / 飞书审批。
- 工单系统审批。
- 按角色自动审批低风险操作。

下一章会加入代码编辑能力，让 Agent 不只读项目，还能安全修改项目。
