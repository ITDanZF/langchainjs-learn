# 03. 最小 CLI 对话程序

## 本章目标

本章实现一个最小 CLI 对话程序：

```text
用户在终端输入一句话
  ↓
Node.js 程序读取输入
  ↓
程序把输入整理成消息列表
  ↓
程序追加一条模拟 assistant 回复
  ↓
打印当前消息列表
```

这一章暂时不接真实大模型，也不接工具系统。先把“命令行输入如何进入程序、程序如何组织消息、如何输出结果”这条最小链路跑通。

## 1. CLI 是什么

CLI 是 Command Line Interface，也就是命令行界面。

对 Agent 项目来说，CLI 是最小、最容易调试的入口。用户可以这样调用程序：

```bash
npm run dev "你好啊"
```

程序收到这段文本后，会把它包装成一条 `user` 消息。后面接入真实模型时，这些消息会一起传给 LLM。

## 2. 读取命令行输入

Node.js 程序启动时，可以通过 `process.argv` 读取命令行参数。

例如执行：

```bash
npm run dev "你好啊 我是 xxxx"
```

`process.argv` 大致可以理解成：

```ts
[
  "node 路径",
  "当前脚本路径",
  "你好啊 我是 xxxx"
]
```

前两个元素通常是 Node.js 自己使用的路径，真正的用户输入从第三个元素开始。所以代码里会这样写：

```ts
const input = process.argv.slice(2).join(" ").trim();
```

这里分成三步理解：

- `slice(2)`：丢掉前两个系统参数，只保留用户输入。
- `join(" ")`：把多个命令行参数重新拼成一个字符串。
- `trim()`：去掉字符串前后的空格。

更推荐用户输入时用引号包起来：

```bash
npm run dev "请总结 README"
```

这样可以避免终端把空格拆成多个参数。

## 3. 定义消息类型

Agent 不应该只保存一个普通字符串，而应该保存一组消息。

创建 `src/types/index.ts`：

```ts
export type Role = "system" | "user" | "assistant" | "tool";

export type ChatMessage = {
  role: Role;
  content: string;
};
```

其中：

| 字段 | 说明 |
| --- | --- |
| `role` | 这条消息是谁发出的 |
| `content` | 这条消息的具体内容 |

常见的 `role` 有：

| role | 含义 | 例子 |
| --- | --- | --- |
| `system` | 系统指令，用来定义助手行为 | 你是一个命令行 Agent |
| `user` | 用户输入 | 你好啊 |
| `assistant` | AI 或模拟 AI 的回复 | 正在执行命令... |
| `tool` | 工具返回结果 | 文件内容是... |

本章先用到 `system`、`user` 和 `assistant`。`tool` 会在后续工具章节使用。

## 4. 创建 CLI 入口

修改 `src/index.ts`：

```ts
import type { ChatMessage } from "./types";

const input = process.argv.slice(2).join(" ").trim();

// 缓存历史消息
const messages: ChatMessage[] = [
  {
    role: "system",
    content: "你是一个命令行agent!",
  },
];

if (!input) {
  console.error("请输入要执行的命令");
  process.exit(1);
}

messages.push({
  role: "user",
  content: input,
});

messages.push({
  role: "assistant",
  content: "正在执行命令...",
});

console.log("当前消息列表：", messages);
```

运行：

```bash
npm run dev "你好啊"
```

你会看到类似输出：

```text
当前消息列表： [
  { role: 'system', content: '你是一个命令行agent!' },
  { role: 'user', content: '你好啊' },
  { role: 'assistant', content: '正在执行命令...' }
]
```

## 5. 封装添加消息的方法

为了让后续代码更清楚，可以把添加消息的逻辑封装成一个小函数：

```ts
function addMsg(msg: ChatMessage) {
  messages.push(msg);
}
```

然后把原来的 `messages.push(...)` 改成：

```ts
addMsg({
  role: "user",
  content: input,
});

addMsg({
  role: "assistant",
  content: "正在执行命令...",
});
```

完整代码：

```ts
import type { ChatMessage } from "./types";

const input = process.argv.slice(2).join(" ").trim();

function addMsg(msg: ChatMessage) {
  messages.push(msg);
}

// 缓存历史消息
const messages: ChatMessage[] = [
  {
    role: "system",
    content: "你是一个命令行agent!",
  },
];

if (!input) {
  console.error("请输入要执行的命令");
  process.exit(1);
}

addMsg({
  role: "user",
  content: input,
});

addMsg({
  role: "assistant",
  content: "正在执行命令...",
});

console.log("当前消息列表：", messages);
```

这个函数现在只是包了一层 `push`，看起来很简单。它的意义是让代码表达更清楚：这里不是随便往数组里塞数据，而是在“添加一条对话消息”。

## 6. 为什么要处理空输入

如果用户没有输入内容，程序不应该继续执行。

例如：

```bash
npm run dev
```

这时 `input` 是空字符串，程序应该提示用户：

```ts
if (!input) {
  console.error("请输入要执行的命令");
  process.exit(1);
}
```

`process.exit(1)` 表示程序以失败状态退出。

常见退出码：

| 退出码 | 含义 |
| --- | --- |
| `0` | 成功 |
| 非 `0` | 失败 |

这对命令行程序很重要。其他脚本可以根据退出码判断这次运行是否成功。

## 7. 当前 messages 的数据长什么样

如果运行：

```bash
npm run dev "你好啊"
```

程序中的 `messages` 大致是：

```ts
[
  {
    role: "system",
    content: "你是一个命令行agent!",
  },
  {
    role: "user",
    content: "你好啊",
  },
  {
    role: "assistant",
    content: "正在执行命令...",
  },
]
```

可以把它理解成一份对话流水账：

```text
系统：你是一个命令行agent!
用户：你好啊
助手：正在执行命令...
```

后续接入真实大模型时，`assistant` 这条消息不会再手写固定内容，而是来自模型返回结果。

## 8. 本章最终结构

本章结束时，推荐文件结构：

```text
src/
  index.ts
  types/
    index.ts
```

`src/types/index.ts` 保存消息类型。

`src/index.ts` 负责：

- 读取命令行输入。
- 判断输入是否为空。
- 初始化 `messages`。
- 添加 `user` 消息。
- 添加模拟 `assistant` 消息。
- 打印消息列表。

## 9. 本章验收

完成本章后，你应该能：

- 理解 `process.argv.slice(2).join(" ").trim()` 的作用。
- 理解 `ChatMessage` 的基本结构。
- 区分 `system`、`user`、`assistant` 消息。
- 从命令行传入用户问题。
- 把用户输入保存到 `messages`。
- 输出一个模拟的 `assistant` 回复。
- 在没有输入时提示错误并退出。

下一章会把固定的 `"正在执行命令..."` 替换成真正的 LLM 调用结果。
