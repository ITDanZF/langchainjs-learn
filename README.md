# Agent TUI 学习项目

这是一个面向 Node.js / TypeScript 智能体开发的学习型仓库。

项目当前包含两条学习主线：

1. 从 0 到 1 手写一个最小 Agent Runtime。
2. 基于 LangChain.js / LangGraph.js 构建更复杂的智能体应用。

## 项目结构

```text
agent-tui/
  docs/
    nodejs-agent-course/        # 第一版：手写 Node.js Agent 教程
    langchainjs-agent-course/   # 第二版：LangChain.js 进阶教程
  mini-agent/                   # 第一版课程配套的最小示例项目
```

## 课程入口

### 第一版：Node.js 智能体基础课程

入口文档：

- [docs/nodejs-agent-course/README.md](docs/nodejs-agent-course/README.md)

这一版重点是理解 Agent 的底层机制：

- CLI 输入。
- messages 结构。
- 大模型调用。
- LLM Client 封装。
- 工具系统。
- Agent Runtime 循环。
- 状态、上下文与记忆。
- mini coding agent。

适合先学习，帮助理解 LangChain.js 这类框架背后到底做了什么。

### 第二版：LangChain.js 智能体进阶课程

入口文档：

- [docs/langchainjs-agent-course/README.md](docs/langchainjs-agent-course/README.md)

这一版重点是使用成熟框架实现复杂应用：

- ChatModel。
- Prompt Template。
- Runnable / LCEL。
- Tools。
- ReAct Agent。
- LangGraph 状态图。
- 多轮记忆。
- RAG 知识库问答。
- 多工具业务助手。
- 评估、观测与部署。

最终目标是实现一个“企业知识库与工单助手”类型的完整 Agent 应用。

## mini-agent 示例项目

`mini-agent/` 是第一版课程的配套示例。

进入目录：

```bash
cd mini-agent
```

安装依赖：

```bash
npm install
```

运行示例：

```bash
npm run dev "你好啊"
```

如果课程进行到真实大模型调用章节，需要在 `mini-agent/.env` 中配置：

```env
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-chat
```

`.env` 不应该提交到 Git。

## 推荐学习路径

建议先按顺序完成：

1. [Node.js 智能体基础课程](docs/nodejs-agent-course/README.md)
2. [LangChain.js 智能体进阶课程](docs/langchainjs-agent-course/README.md)

学习顺序可以理解为：

```text
先手写，理解机制
  ↓
再用框架，构建复杂应用
```

## 常用命令

在 `mini-agent/` 目录下：

```bash
npm install
npm run dev "你好啊"
npx tsc --noEmit
```

## 注意事项

- 不要提交 `.env`、API Key 或其他敏感信息。
- 教程中的代码会随着章节逐步演进，不同章节展示的代码可能代表不同学习阶段。
- 如果实际代码和教程章节不一致，应优先确认当前正在学习的是哪一章。
