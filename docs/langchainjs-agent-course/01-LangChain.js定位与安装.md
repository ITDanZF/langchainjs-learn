# 01. LangChain.js 定位与安装

## 本章目标

本章要回答三个问题：

1. LangChain.js 是什么。
2. 它和第一版手写 agent 有什么关系。
3. 如何初始化一个 LangChain.js TypeScript 项目。

## 1. LangChain.js 是什么

LangChain.js 是一个用于构建 LLM 应用的 JavaScript/TypeScript 框架。

它提供的不是一个单独功能，而是一组可组合模块：

- 模型调用：Chat Model、Embedding Model。
- Prompt 管理：模板、占位符、消息模板。
- 链式组合：Runnable、LCEL。
- 工具调用：tool、schema、agent。
- 检索增强生成：Loader、Splitter、Retriever、Vector Store。
- 智能体：ReAct agent、tool calling agent。
- 工作流：LangGraph.js。
- 观测评估：LangSmith。

## 2. 为什么已经手写过还要学它

第一版课程里我们手写了：

```text
LLMClient
Tool
ToolRegistry
AgentRuntime
Memory
```

这些是理解 Agent 的基础。

但真实项目中，继续全手写会很快遇到工程问题：

- 每个模型供应商接口不同。
- Prompt 拼接容易混乱。
- 工具参数需要稳定校验。
- Agent loop 需要可观测。
- RAG 需要文档加载、切分、检索。
- 复杂应用需要状态图，而不是单个 while 循环。

LangChain.js 的价值，就是把这些常见问题抽成标准模块。

## 3. 创建项目

进入你准备放示例项目的目录：

```bash
mkdir langchain-agent-demo
cd langchain-agent-demo
npm init -y
```

安装 TypeScript 开发依赖：

```bash
npm install -D typescript tsx @types/node
npx tsc --init
```

安装 LangChain.js 相关依赖：

```bash
npm install langchain @langchain/core @langchain/openai @langchain/langgraph zod dotenv
```

后续做 RAG 时还会用到向量库和文档加载器。本章先不安装，避免一开始依赖过重。

## 4. package.json 脚本

添加：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts"
  }
}
```

如果你的 `package.json` 已经有其他字段，只需要合并这些字段，不要整文件覆盖。

## 5. 环境变量

创建 `.env`：

```env
DEEPSEEK_API_KEY=你的 DeepSeek Key
DEEPSEEK_MODEL=deepseek-chat
```

不要把 `.env` 提交到 Git。

## 6. 配置读取

创建 `src/config.ts`：

```ts
import "dotenv/config";

export const config = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY ?? "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL ?? "deepseek-chat",
};
```

## 7. 本章验收

完成后，你应该能：

- 说清楚 LangChain.js 和手写 agent 的关系。
- 初始化一个 TypeScript 项目。
- 安装 LangChain.js 核心依赖。
- 准备好 DeepSeek 的环境变量。

下一章会用 LangChain.js 的 `ChatOpenAI` 接入 DeepSeek。
