# Agent TUI

一个用 Node.js 和 TypeScript 学习 AI Agent 的实践仓库。

这个项目不是直接套一个现成框架，而是从最小的命令行对话程序开始，逐步拆解并实现一个 Agent Runtime：消息、模型调用、流式输出、工具系统、权限控制、运行循环、记忆和最终的 mini coding agent。

如果你也想弄清楚 LangChain、LangGraph、Claude Code、Copilot 这类 Agent 工具背后到底在做什么，这个仓库就是一条偏工程实践的学习路线。

## 为什么做这个项目

今天写 AI 应用已经很容易了，但真正困难的是理解这些问题：

- Agent 为什么不只是一次大模型调用？
- messages、system prompt、tool call、memory 分别承担什么角色？
- 工具调用为什么需要 schema、权限和错误处理？
- 一个 coding agent 是如何读文件、搜代码、跑命令、分析失败并继续下一轮的？
- 什么时候应该手写，什么时候应该使用 LangChain.js / LangGraph.js 这类框架？

这个项目的目标是把这些概念拆成可以运行、可以修改、可以调试的小步骤。

## 适合谁

- 想系统学习 AI Agent，但不满足于只调用一个 SDK 的开发者。
- 熟悉 JavaScript / TypeScript，想进入 LLM 应用开发的人。
- 想理解工具调用、Agent Loop、记忆、RAG、工作流编排的工程实现的人。
- 想从“会用 AI 写代码”进一步走向“能设计 AI 编程工具”的人。

## 项目亮点

- 从 0 到 1 手写最小 Agent Runtime，不把核心机制藏在框架后面。
- 使用 Node.js / TypeScript，适合前端、全栈和 Node.js 开发者学习。
- 包含真实大模型调用示例，目前示例项目以 DeepSeek API 为主。
- 设计了消息缓存、流式输出、工具注册、Zod 参数校验和工具权限分层。
- 提供两条学习路径：先手写底层机制，再使用 LangChain.js / LangGraph.js 构建复杂应用。
- 最终目标是实现一个迷你编程智能体，能围绕项目文件、搜索、命令执行和测试反馈形成工作循环。

## 仓库结构

```text
agent-tui/
  docs/
    nodejs-agent-course/        # 第一版：手写 Node.js Agent 教程
    langchainjs-agent-course/   # 第二版：LangChain.js / LangGraph.js 进阶教程
  mini-agent/                   # 第一版课程配套的最小 Agent 示例项目
```

## 学习路线

建议学习顺序是：

```text
先手写，理解机制
  ↓
再用框架，构建复杂应用
```

### 第一阶段：手写 Node.js Agent

入口文档：[docs/nodejs-agent-course/README.md](docs/nodejs-agent-course/README.md)

这一阶段会从最小 CLI 程序开始，逐步实现：

- 命令行输入与多轮对话。
- OpenAI-compatible Chat Completions 调用。
- DeepSeek API 接入。
- 流式输出。
- LLM Client 封装。
- Tool Registry 工具注册中心。
- 文件读取、搜索和命令执行工具。
- Agent Runtime 循环。
- 状态、上下文与记忆。
- 迷你编程智能体。

### 第二阶段：LangChain.js / LangGraph.js 进阶

入口文档：[docs/langchainjs-agent-course/README.md](docs/langchainjs-agent-course/README.md)

这一阶段会在理解底层机制后，使用成熟框架实现更复杂的 Agent 应用：

- ChatModel 与 Prompt Template。
- Runnable / LCEL 管道。
- Tools 与结构化输出。
- ReAct Agent。
- LangGraph 状态图。
- 多轮记忆和检查点。
- RAG 知识库问答。
- 多工具业务助手。
- 评估、观测与部署。
- 企业知识库与工单助手综合项目。

## mini-agent 当前能力

`mini-agent/` 是当前正在演进的最小示例项目，目前已经包含：

- TypeScript + ESM 项目结构。
- `.env` 配置读取。
- DeepSeek Chat Completions 流式调用。
- `user / assistant / system / tool` 消息类型设计。
- 基于内存的消息缓存。
- 工具定义、工具注册、工具查找和工具执行入口。
- 基于 Zod 的工具参数校验。
- `read / write / execute_safe / execute_risky` 工具权限分层设计。

它还在学习型开发阶段，部分章节中的能力会随着课程推进逐步补全。

## 快速开始

进入示例项目：

```bash
cd mini-agent
```

安装依赖：

```bash
npm install
```

配置环境变量：

```env
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-chat
```

运行开发命令：

```bash
npm run dev
```

类型检查：

```bash
npx tsc --noEmit
```

构建：

```bash
npm run build
```

注意：当前 `mini-agent` 代码会跟随教程章节持续演进。如果运行行为和某一章文档不一致，请以当前正在学习的章节为准。

## 计划中的能力

- 完善 CLI 交互入口。
- 增加 `list_files`、`read_file`、`search_text` 等项目观察工具。
- 增加受控的 `run_command` 命令执行工具。
- 实现模型选择工具、执行工具、接收观察结果的 Agent Loop。
- 增加上下文裁剪和消息摘要。
- 增加写文件前 diff 展示和用户确认机制。
- 增加测试反馈循环，让 Agent 可以分析失败并提出修复方案。
- 增加更完整的 TUI 体验。

## 项目原则

- 先理解机制，再追求封装。
- 先保证可控，再增加自动化。
- 工具执行必须有权限边界。
- 写文件、执行高风险命令前应有确认流程。
- 示例代码优先服务学习，不追求一开始就做成通用框架。

## 常用命令

在 `mini-agent/` 目录下：

```bash
npm install
npm run dev
npx tsc --noEmit
npm run build
```

## 安全提醒

- 不要提交 `.env`、API Key、Token 或其他敏感信息。
- 命令执行工具应设置 allowlist、超时和权限确认。
- 写文件工具应限制在 workspace 内，并在写入前展示 diff。
- 自动修复类能力应限制最大轮数、最大修改文件数和连续失败次数。

## 欢迎关注

这个项目会持续记录我从 0 到 1 学习和实现 AI Agent 的过程。

如果你也在学习 Agent、LLM 应用工程、LangChain.js、LangGraph.js 或 AI 编程工具，欢迎一起交流、提 issue、补充案例，或者把这个仓库当作自己的学习路线图。
