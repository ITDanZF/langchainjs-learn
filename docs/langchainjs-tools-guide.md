# LangChainJS Tools 官方文档教程

本文依据 LangChain JavaScript 官方文档整理，目标是说明 LangChainJS 中工具的定义方式、Agent 如何调用工具、工具返回值如何处理，以及如何接入第三方工具和工具包。

官方参考：

- Tools: https://docs.langchain.com/oss/javascript/langchain/tools
- Agents: https://docs.langchain.com/oss/javascript/langchain/agents
- Tool integrations: https://docs.langchain.com/oss/javascript/integrations/tools

## 1. 工具是什么

在 LangChainJS 中，工具是可被模型调用的函数。

官方文档的核心定义是：

```txt
Tools are callable functions with well-defined inputs and outputs.
```

工具会被传给 chat model。模型根据当前对话上下文决定：

```txt
是否调用工具
调用哪个工具
给工具传什么参数
```

工具通常用于让 Agent 执行模型本身不能直接完成的事情，例如：

```txt
获取实时数据
执行代码
查询数据库
调用外部 API
读写业务系统
```

## 2. Agent 和工具的关系

官方文档中对 Agent 的定义可以理解为：

```txt
Agent = model calling tools in a loop until a task is complete
```

最小示例：

```ts
import { createAgent } from "langchain";

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools,
});
```

带工具的例子：

```ts
import { createAgent, tool } from "langchain";
import * as z from "zod";

const search = tool(
  ({ query }) => `Results for: ${query}`,
  {
    name: "search",
    description: "Search for information",
    schema: z.object({
      query: z.string(),
    }),
  },
);

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [search],
});
```

执行流程：

```txt
用户输入
  -> 模型判断需要 search
  -> LangChain 执行 search 工具
  -> 工具结果变成 ToolMessage
  -> 模型读取 ToolMessage
  -> 模型输出最终回答
```

## 3. 使用 `tool()` 定义工具

官方推荐使用 `langchain` 包导出的 `tool` 函数定义工具。

基础结构：

```ts
import { tool } from "langchain";
import * as z from "zod";

const myTool = tool(
  async (input) => {
    return "tool result";
  },
  {
    name: "my_tool",
    description: "Describe when the model should use this tool.",
    schema: z.object({
      query: z.string(),
    }),
  },
);
```

一个工具包含：

```txt
name
  工具名称。模型会通过这个名字调用工具。

description
  工具描述。模型依赖它判断何时使用工具。

schema
  工具入参结构。官方示例使用 zod。

handler
  真正执行工具逻辑的函数。
```

官方建议工具名使用 `snake_case`，例如：

```txt
web_search
search_database
get_weather
```

原因是部分模型提供商可能不接受包含空格或特殊字符的工具名。

## 4. 使用 Zod 定义工具参数

官方示例使用 `zod` 定义工具输入。

```ts
import { tool } from "langchain";
import * as z from "zod";

const searchDatabase = tool(
  ({ query, limit }) => {
    return `Found ${limit} results for '${query}'`;
  },
  {
    name: "search_database",
    description: "Search the customer database for records matching the query.",
    schema: z.object({
      query: z.string().describe("Search terms to look for"),
      limit: z.number().describe("Maximum number of results to return"),
    }),
  },
);
```

`schema` 的作用：

```txt
约束模型生成的工具参数
帮助模型理解每个参数的含义
在执行工具前进行参数校验
```

## 5. Agent 如何调用工具

把工具放进 `createAgent` 的 `tools` 数组即可：

```ts
const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [searchDatabase],
});
```

调用 Agent：

```ts
const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "Search for customers named Alice",
    },
  ],
});
```

工具调用是自动发生的。应用代码通常不需要手动判断：

```txt
如果用户问了需要工具的问题，模型会请求调用工具。
如果用户的问题不需要工具，模型可以直接回答。
```

## 6. 工具返回值

官方文档说明工具可以返回多种类型。

### 6.1 返回字符串

适合人类可读的简单结果。

```ts
const getWeather = tool(
  ({ city }) => `It is currently sunny in ${city}.`,
  {
    name: "get_weather",
    description: "Get weather for a city.",
    schema: z.object({
      city: z.string(),
    }),
  },
);
```

行为：

```txt
返回值会转换成 ToolMessage
模型会读取这个文本
模型再决定下一步如何回答
```

### 6.2 返回对象

适合结构化数据。

```ts
const getWeatherData = tool(
  ({ city }) => ({
    city,
    temperature_c: 22,
    conditions: "sunny",
  }),
  {
    name: "get_weather_data",
    description: "Get structured weather data for a city.",
    schema: z.object({
      city: z.string(),
    }),
  },
);
```

行为：

```txt
对象会被序列化为工具输出
模型可以读取字段并进行推理
```

### 6.3 返回多模态内容

当模型支持多模态工具结果时，工具可以返回内容块。

```ts
const captureScreenshot = tool(
  async () => [
    { type: "text", text: "Screenshot of the current page:" },
    { type: "image", url: "https://example.com/page.png" },
  ],
  {
    name: "capture_screenshot",
    description: "Capture a screenshot of the current page.",
    schema: z.object({}),
  },
);
```

使用前需要确认模型是否支持对应模态。

### 6.4 返回 Command

当工具不仅返回数据，还需要更新 Agent state 时，可以返回 `Command`。

官方示例场景：

```txt
设置用户偏好
更新应用状态
向 graph state 写入字段
```

这种模式通常用于更高级的 LangGraph/Agent state 场景。

### 6.5 `returnDirect`

如果工具输出本身就是最终答案，可以设置 `returnDirect: true`。

```ts
const fetchOrderStatus = tool(
  ({ order_id }) => {
    return `Order ${order_id} is shipped and will arrive in 2 days.`;
  },
  {
    name: "fetch_order_status",
    description: "Fetch the current status of a customer order.",
    schema: z.object({
      order_id: z.string(),
    }),
    returnDirect: true,
  },
);
```

效果：

```txt
工具执行后，Agent 直接返回工具输出
不会再把工具结果交给模型二次改写
```

适合：

```txt
订单状态查询
确定性业务查询
工具输出已经是用户可见答案
```

不适合：

```txt
需要模型总结、推理、改写、组合多个工具结果的场景
```

## 7. 工具如何访问运行时上下文

官方文档区分了两个概念：

```txt
thread_id
  用来限定对话、消息历史和 checkpoint。

context
  每次调用时传入的运行时配置，工具和 middleware 可以读取。
```

示例：

```ts
import * as z from "zod";
import { createAgent, tool } from "langchain";

const getUserName = tool(
  (_, config) => {
    return config.context.user_name;
  },
  {
    name: "get_user_name",
    description: "Get the user's name.",
    schema: z.object({}),
  },
);

const contextSchema = z.object({
  user_name: z.string(),
});

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [getUserName],
  contextSchema,
});

const result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content: "What is my name?",
      },
    ],
  },
  {
    configurable: {
      thread_id: crypto.randomUUID(),
    },
    context: {
      user_name: "John Smith",
    },
  },
);
```

适合放进 `context` 的数据：

```txt
user_id
workspace_id
权限信息
本次调用的 feature flags
请求来源
```

## 8. 工具和短期记忆

官方 Agent 调用示例中，`thread_id` 用来维持同一会话的历史：

```ts
const config = {
  configurable: {
    thread_id: crypto.randomUUID(),
  },
};

let result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content: "What's the weather in San Francisco?",
      },
    ],
  },
  config,
);

result = await agent.invoke(
  {
    messages: [
      {
        role: "user",
        content: "What about tomorrow?",
      },
    ],
  },
  config,
);
```

要持久化对话历史，需要给 Agent 配置 checkpointer。

```ts
import { MemorySaver } from "@langchain/langgraph";

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [],
  checkpointer: new MemorySaver(),
});
```

如果工具被调用，工具调用过程也会作为 Agent state 的一部分参与后续上下文。

## 9. 工具错误处理

官方文档推荐通过 middleware 处理工具错误。

示例：

```ts
import { createAgent, createMiddleware, ToolMessage } from "langchain";

const handleToolErrors = createMiddleware({
  name: "HandleToolErrors",
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request);
    } catch (error) {
      return new ToolMessage({
        content: `Tool error: Please check your input and try again. (${error})`,
        tool_call_id: request.toolCall.id!,
      });
    }
  },
});

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [],
  middleware: [handleToolErrors],
});
```

这种方式的好处是：

```txt
工具失败不会直接炸掉整个 Agent
模型可以看到错误消息
模型可以尝试修正参数或给用户解释
```

## 10. 动态工具选择

官方文档提到，工具集可以动态选择。

典型场景：

```txt
不同用户权限不同
不同会话阶段开放不同工具
不同 feature flag 启用不同工具
未登录用户只能使用 public 工具
管理员可以使用更多工具
```

官方文档描述了两类方式：

```txt
1. 所有工具启动时已知，运行时过滤工具
2. 工具在运行时动态发现或注册
```

如果所有工具都已知，可以通过 middleware 在模型调用前过滤工具。

概念流程：

```txt
request.tools
  -> 根据权限/状态/context 过滤
  -> handler({ ...request, tools: filteredTools })
```

## 11. Headless tools

官方文档还提到 headless tools。

这类工具不是直接暴露给模型选择，而是由系统或 middleware 在背后调用。

适合：

```txt
系统必须执行但不希望模型决定的动作
内部数据准备
安全检查
审计记录
固定流程节点
```

## 12. 预构建工具和第三方工具

官方 Tool integrations 页面说明：

```txt
Tool
  设计为由模型调用的工具。

Toolkit
  一组应该一起使用的工具集合。
```

第三方工具接入通常有两种方式。

### 12.1 使用官方/社区工具包

工具包通常会暴露多个工具。

概念示例：

```ts
const toolkit = new SomeToolkit(options);
const tools = toolkit.getTools();

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools,
});
```

### 12.2 把第三方 SDK 包装成 LangChain tool

如果第三方服务没有现成 LangChain tool，可以自己包装。

```ts
import { tool } from "langchain";
import * as z from "zod";

const externalSearch = tool(
  async ({ query }) => {
    const result = await thirdPartyClient.search(query);
    return JSON.stringify(result);
  },
  {
    name: "external_search",
    description: "Search external data source.",
    schema: z.object({
      query: z.string(),
    }),
  },
);
```

然后：

```ts
const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [externalSearch],
});
```

## 13. 官方文档中的集成类型

官方 Tool integrations 页面列出了许多工具/工具包方向，包括：

```txt
Composio
Tavily Search / Extract / Crawl / Map
Web Browser Tool
Dall-E Tool
Google native tools
AWS Lambda agent
数据库相关工具
```

实际使用时，以对应集成页面的安装和初始化方式为准。

## 14. 最小官方风格示例

```ts
import { createAgent, tool } from "langchain";
import * as z from "zod";

const getWeather = tool(
  ({ city }) => {
    return `It is currently sunny in ${city}.`;
  },
  {
    name: "get_weather",
    description: "Get weather for a city.",
    schema: z.object({
      city: z.string(),
    }),
  },
);

const agent = createAgent({
  model: "openai:gpt-5.5",
  tools: [getWeather],
});

const result = await agent.invoke({
  messages: [
    {
      role: "user",
      content: "What's the weather in Shanghai?",
    },
  ],
});

console.log(result.messages.at(-1)?.content);
```

## 15. 关键结论

```txt
1. LangChainJS 工具是带 schema 的函数。
2. 使用 tool() 定义工具。
3. 使用 zod 描述工具参数。
4. 把工具放入 createAgent({ tools })。
5. 模型自动决定何时调用工具。
6. 工具返回值会变成 ToolMessage。
7. 模型读取 ToolMessage 后生成最终回答。
8. thread_id 负责对话历史和 checkpoint。
9. context 负责传入工具可读的运行时配置。
10. 第三方工具可以直接使用 toolkit，也可以手动包装 SDK。
```

