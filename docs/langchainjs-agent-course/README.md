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
- 流式输出。
- 文件读取、目录列表、文本搜索、受限命令执行。
- LangChain.js Agent 工具调用。
- LangGraph.js 状态、分支、检查点和会话记忆。
- 本地 Markdown RAG 知识库。
- 企业级配置、日志、错误、测试、评估和发布结构。

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

## 学习方式

每章都遵循同一个节奏：

1. 说明为什么需要这个能力。
2. 给出本章要新增的文件。
3. 写出可运行的最小实现。
4. 说明企业级项目中还要补什么。
5. 给出验收命令。

这样你不是在“看 API”，而是在一步步搭建完整系统。
