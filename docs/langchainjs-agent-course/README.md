# LangChain.js 智能体进阶课程

> 第二版进阶课程：在第一版手写 Agent Runtime 的基础上，系统学习 LangChain.js 与 LangGraph.js，并用框架实现更复杂的应用程序。

## 课程定位

第一版课程的重点是理解底层机制：

```text
messages → LLM client → tools → agent loop → memory → CLI/TUI
```

第二版课程的重点是用成熟框架构建应用：

```text
LangChain.js → LCEL → Tools → Agent → LangGraph → Memory → RAG → 复杂业务应用
```

这不是替代第一版，而是基于第一版继续升级。

## 课程目录

| 章节 | 文档 | 主题 |
| --- | --- | --- |
| 00 | [进阶课程总览](./00-进阶课程总览.md) | 学习路径、项目结构、最终产物 |
| 01 | [LangChain.js 定位与安装](./01-LangChain.js定位与安装.md) | 框架定位、依赖安装、与手写版本的映射 |
| 02 | [ChatModel 与 Prompt 模板](./02-ChatModel与Prompt模板.md) | ChatOpenAI、DeepSeek 接入、PromptTemplate |
| 03 | [Runnable 与 LCEL 管道](./03-Runnable与LCEL管道.md) | Runnable、pipe、invoke、stream、批处理 |
| 04 | [Tools 与结构化输出](./04-Tools与结构化输出.md) | tool、zod schema、结构化返回、错误处理 |
| 05 | [基于 createReactAgent 的工具智能体](./05-基于createReactAgent的工具智能体.md) | ReAct Agent、工具选择、工具调用闭环 |
| 06 | [LangGraph 状态图与可控循环](./06-LangGraph状态图与可控循环.md) | StateGraph、节点、边、条件路由 |
| 07 | [记忆、检查点与多轮会话](./07-记忆检查点与多轮会话.md) | MemorySaver、thread_id、会话恢复 |
| 08 | [RAG 知识库问答应用](./08-RAG知识库问答应用.md) | 文档加载、切分、向量检索、引用回答 |
| 09 | [多工具业务助手](./09-多工具业务助手.md) | 文件、搜索、命令、业务 API 组合 |
| 10 | [复杂应用工程化](./10-复杂应用工程化.md) | 配置、模块边界、日志、错误、测试 |
| 11 | [评估、观测与部署](./11-评估观测与部署.md) | LangSmith、回归评估、成本、部署形态 |
| 12 | [综合项目：企业知识库与工单助手](./12-综合项目企业知识库与工单助手.md) | LangChain.js、LangGraph.js、RAG、多工具综合实战 |

## 推荐学习方式

1. 先完成第一版课程的 03 到 09，理解消息、工具和 agent loop。
2. 再学习本课程 01 到 05，用 LangChain.js 重写基础 agent。
3. 继续学习 06 到 07，用 LangGraph.js 实现可控状态机。
4. 用 08 到 09 做 RAG 和多工具业务助手。
5. 用 10 到 11 做工程化、评估和部署。
6. 最后用 12 完成综合项目。

## 最终产物

学完后，你应该能实现：

- 一个基于 LangChain.js 的 CLI agent。
- 一个支持工具调用的 ReAct agent。
- 一个基于 LangGraph.js 的可控工作流 agent。
- 一个支持多轮记忆的会话助手。
- 一个 RAG 知识库问答应用。
- 一个组合文件、搜索、命令和业务 API 的复杂 agent 应用。
- 一个企业知识库与工单助手综合项目。
