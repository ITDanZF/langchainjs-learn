# 19. 服务化 API 与任务队列

## 本章目标

到第 18 章，核心 Agent 能力已经完整。本章把 CLI 背后的核心能力服务化，方便接入 Web、企业 IM 和后台任务。

CLI 很适合学习和本地使用，但企业系统通常还需要 API 服务。

本章设计：

```text
CLI / Web / 企业 IM
        ↓
HTTP API
        ↓
Task Queue
        ↓
Agent Worker
```

## 1. 为什么要服务化

服务化后可以：

- 接入 Web UI。
- 接入飞书、Slack、企业微信。
- 支持长任务后台运行。
- 支持多用户和权限。
- 集中记录日志和审计。

## 2. API 能力设计

建议接口：

```text
POST /tasks              创建任务
GET  /tasks/:id          查询任务状态
GET  /tasks/:id/events   订阅流式事件
POST /chat               单轮或多轮会话
POST /index              创建索引任务
```

任务状态：

```text
queued → running → waiting_approval → completed
                      ↓
                    failed
```

## 3. 任务数据结构

```ts
export type AgentTask = {
  id: string;
  userId: string;
  threadId?: string;
  input: string;
  status: "queued" | "running" | "waiting_approval" | "completed" | "failed";
  createdAt: string;
  updatedAt: string;
};
```

## 4. 队列设计

教学版可以用内存队列：

```text
src/server/queue.ts
```

企业版建议：

- BullMQ + Redis。
- Temporal。
- Cloud task queue。
- LangGraph Platform。

## 5. 流式事件

服务端不要只返回最终结果，应该输出事件：

```text
task.started
token.delta
tool.called
tool.completed
approval.required
task.completed
task.failed
```

CLI、Web、IM 都可以消费同一套事件。

## 6. Worker 复用核心模块

不要在 API 层重写 Agent。正确结构是：

```text
src/core/agent-service.ts
```

CLI 和 HTTP API 都调用它。

## 7. 验收

本章可以先不完整实现服务，只完成设计文档和接口类型。

进阶实现：

```bash
npm run server
curl -X POST http://localhost:3000/tasks -d '{"input":"总结项目结构"}'
```

## 8. 企业级思考

一旦服务化，就必须考虑：

- 鉴权。
- 限流。
- 多租户隔离。
- 任务取消。
- 审批回调。
- 数据脱敏。

下一章会补企业安全与合规。
