# mini-agent-langchain 主线导图

这份导图负责把 01–12 的基础实现篇和 13–22 的企业增强篇串成一条连续路线。

## 一句话主线

```text
先做出一个能用的 Agent CLI，再把它升级成可规划、可审批、可编辑、可治理、可服务化、可扩展的企业 Agent 平台。
```

## 阶段关系

| 阶段 | 章节 | 目标 | 产物 | 为下一阶段提供什么 |
| --- | --- | --- | --- | --- |
| CLI 骨架 | 01 | 项目初始化 | `mini-agent` 命令入口 | 后续所有能力的承载入口 |
| 模型问答 | 02–03 | 模型调用与流式输出 | `mini-agent ask` | 后续 Agent 的模型封装和输出体验 |
| 工具系统 | 04 | 本地工具能力 | `list_files`、`read_file`、`search_text` | Agent 可以接触真实项目上下文 |
| Agent 执行 | 05 | 自动选择工具 | `mini-agent run` | 从聊天变成任务执行 |
| 可控运行时 | 06–07 | LangGraph 和记忆 | `run --graph`、`chat` | 支撑审批、中断、多轮和复杂流程 |
| 知识库 | 08 | 本地 RAG | `mini-agent index`、`search_docs` | 支撑企业文档问答和引用回答 |
| 安全工具箱 | 09 | 命令执行与权限雏形 | `run_command` | 为审批流和开发助手做准备 |
| 工程闭环 | 10–12 | 测试、评估、发布、综合验收 | `eval`、`build`、基础综合项目 | 基础篇结束，进入企业增强篇 |
| 规划执行 | 13 | 复杂任务先规划 | `mini-agent plan`、`run --planned` | 长任务可解释、可追踪 |
| 人工审批 | 14 | 高风险操作确认 | approval node | 把第 09 章的权限雏形升级为正式流程 |
| 代码编辑 | 15 | 安全修改项目 | `mini-agent edit`、patch workflow | 从只读助手升级为开发助手 |
| 知识治理 | 16 | 高级 RAG | 增量索引、混合检索、权限过滤 | 从本地 RAG 升级为企业知识库 |
| 模型治理 | 17 | 多模型和成本 | model router | 不同任务用不同模型，控制成本 |
| 团队协作 | 18 | 多 Agent 工作流 | Planner / Executor / Reviewer | 复杂任务分工和结果审查 |
| 服务化 | 19 | API 和队列 | server、task queue、events | 从本地 CLI 扩展到企业系统 |
| 安全合规 | 20 | 权限与审计 | permission、audit、guardrails | 满足企业安全底线 |
| 插件生态 | 21 | 工具扩展 | plugin registry | 业务团队可持续接入工具 |
| 平台蓝图 | 22 | 总架构 | Agent platform roadmap | 从课程项目走向真实平台 |

## 关键衔接点

### 04 → 05：工具交给 Agent

第 04 章只是定义工具，第 05 章把工具交给 `createAgent()`，所以 `run` 命令第一次具备行动能力。

### 05 → 06：黑盒 Agent 变成可控 Graph

第 05 章能快速跑通，第 06 章把循环显式化。后续审批、记忆、多 Agent 都依赖这个 Graph 基础。

### 08 → 16：最小 RAG 升级为知识库治理

第 08 章先让文档可检索，第 16 章再补增量索引、元数据、混合检索、权限过滤和引用治理。

### 09 → 14：权限提示升级为审批流

第 09 章只是识别高风险命令，第 14 章把它接入 Human-in-the-loop，让用户确认成为 Graph 的正式节点。

### 10–12 → 13：基础项目升级为复杂任务系统

第 12 章证明系统已经能用；第 13 章开始解决“复杂任务怎么稳定完成”。规划器会复用前面的模型、工具、Graph、评估和日志。

### 15 → 18：代码编辑需要多 Agent 审查

第 15 章让 Agent 能生成 patch，第 18 章引入 Reviewer，避免 Agent 自己生成代码又自己放行。

### 19 → 21：服务化后需要插件生态

第 19 章把能力开放为服务，第 21 章让外部工具以插件方式接入，避免核心项目无限膨胀。

## 推荐学习路径

如果你想稳扎稳打：

```text
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12
```

如果你想做开发助手：

```text
01–12 → 13 → 14 → 15 → 18
```

如果你想做企业知识库助手：

```text
01–12 → 16 → 17 → 20
```

如果你想做企业平台：

```text
01–12 → 13 → 14 → 17 → 18 → 19 → 20 → 21 → 22
```

## 最终演进图

```text
mini-agent ask
  ↓
mini-agent run
  ↓
mini-agent run --graph
  ↓
mini-agent chat
  ↓
mini-agent index + search_docs
  ↓
mini-agent eval
  ↓
mini-agent plan
  ↓
mini-agent run --planned
  ↓
mini-agent edit
  ↓
mini-agent run --team
  ↓
mini-agent server + plugins
```
