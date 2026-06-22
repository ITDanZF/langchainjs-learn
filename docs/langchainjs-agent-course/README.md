# mini-agent-langchain 企业级 Agent CLI 教程

> 从一个空的 `mini-agent-langchain` 文件夹开始，循序渐进实现一个可维护、可扩展、可观测的企业级 Agent 命令行系统。

## 课程定位

本教程只围绕一个项目展开：`mini-agent-langchain`。

你不会一上来就写复杂 Agent，而是按企业项目的成长路径逐步完善：

```text
空项目
  ↓
TypeScript CLI
  ↓
模型调用与流式输出
  ↓
工具系统
  ↓
Agent 任务执行
  ↓
LangGraph 状态机
  ↓
记忆与会话
  ↓
RAG 知识库
  ↓
权限、安全、日志、评估、部署
```

## 最终项目能力

完成后，`mini-agent-langchain` 会支持：

```bash
mini-agent ask "解释这个项目的功能"
mini-agent chat --thread dev
mini-agent run "阅读 docs 目录并总结课程结构"
mini-agent index docs
mini-agent eval
```

核心能力包括：

- 命令行入口与多子命令。
- OpenAI 兼容模型接入，例如 DeepSeek。
- 流式输出与事件流设计。
- 文件读取、目录列表、文本搜索、受限命令执行。
- LangChain.js Agent 工具调用。
- LangGraph.js 状态、分支、检查点和会话记忆。
- 本地 Markdown RAG 知识库。
- 规划器、任务分解和结构化执行计划。
- Human-in-the-loop 审批流。
- 安全代码编辑与补丁工作流。
- 高级 RAG：增量索引、元数据、混合检索、引用治理。
- 多模型路由、成本控制和降级策略。
- 多 Agent 协作：Planner、Executor、Reviewer。
- 服务化 API、任务队列和流式事件。
- 安全合规、权限体系和审计日志。
- 插件化工具生态。
- 企业级配置、日志、错误、测试、评估和发布结构。

## 主线导图

如果你想先看 01–22 章如何串成一条线，先读：

- [mini-agent-langchain 主线导图](./ROADMAP.md)

## 章节目录

| 章节 | 文档 | 项目增量 |
| --- | --- | --- |
| 00 | [课程总览](./00-进阶课程总览.md) | 明确最终架构和学习路线 |
| 01 | [项目初始化](./01-LangChain.js定位与安装.md) | 把空目录变成 TypeScript CLI 项目 |
| 02 | [模型与 Prompt](./02-ChatModel与Prompt模板.md) | 实现 `mini-agent ask` |
| 03 | [Runnable 与流式输出](./03-Runnable与LCEL管道.md) | 让回答逐步输出到终端 |
| 04 | [工具系统](./04-Tools与结构化输出.md) | 实现文件、目录、搜索工具 |
| 05 | [Agent 任务执行](./05-基于createReactAgent的工具智能体.md) | 实现 `mini-agent run` |
| 06 | [LangGraph 状态机](./06-LangGraph状态图与可控循环.md) | 显式控制 Agent 运行循环 |
| 07 | [会话记忆](./07-记忆检查点与多轮会话.md) | 实现 `mini-agent chat` |
| 08 | [本地知识库 RAG](./08-RAG知识库问答应用.md) | 实现 `mini-agent index` 和文档问答 |
| 09 | [企业工具箱与权限](./09-多工具业务助手.md) | 增加命令工具和安全策略 |
| 10 | [工程化](./10-复杂应用工程化.md) | 配置、日志、错误、测试、模块边界 |
| 11 | [评估观测部署](./11-评估观测与部署.md) | eval、LangSmith、发布和成本控制 |
| 12 | [综合项目](./12-综合项目企业知识库与工单助手.md) | 完整企业知识库与任务助手 |
| 13 | [规划器与任务分解](./13-规划器与任务分解.md) | 增加 `plan` 和规划型执行 |
| 14 | [Human-in-the-loop 审批](./14-Human-in-the-loop审批.md) | 高风险操作确认与审计 |
| 15 | [代码编辑与补丁工作流](./15-代码编辑与补丁工作流.md) | 安全修改代码、展示 diff、运行验证 |
| 16 | [高级 RAG 与知识库治理](./16-高级RAG与知识库治理.md) | 增量索引、元数据、混合检索、权限过滤 |
| 17 | [多模型路由与成本控制](./17-多模型路由与成本控制.md) | fast/reasoning/code/rag 模型分层 |
| 18 | [多 Agent 协作](./18-多Agent协作.md) | Planner、Executor、Reviewer 协作 |
| 19 | [服务化 API 与队列](./19-服务化API与队列.md) | HTTP API、任务队列、流式事件 |
| 20 | [安全合规与权限体系](./20-安全合规与权限体系.md) | 权限、Prompt 注入防护、审计 |
| 21 | [插件化工具生态](./21-插件化工具生态.md) | 插件接口、工具注册、扩展治理 |
| 22 | [最终企业架构蓝图](./22-最终企业架构蓝图.md) | 从 CLI 项目走向 Agent 平台 |

## 学习方式

课程分成两段：

- **基础实现篇 01–12**：把 `mini-agent-langchain` 从空项目做成可用 Agent CLI，得到模型、工具、Graph、记忆、RAG、评估这条主干。
- **企业增强篇 13–22**：不另起炉灶，而是在基础篇主干上继续加能力：规划复用模型和 Graph，审批复用权限策略，代码编辑复用工具系统，高级 RAG 复用第 08 章索引，服务化复用 CLI 背后的核心模块。

每章都遵循同一个节奏：

1. 说明为什么需要这个能力。
2. 给出本章要新增的文件。
3. 写出可运行的最小实现或清晰架构方案。
4. 说明企业级项目中还要补什么。
5. 给出验收命令。

这样你不是在“看 API”，而是在一步步搭建完整系统。
