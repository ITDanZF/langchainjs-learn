# 04b. 交互式 CLI 与流式输出

## 本章目标

上一章用 `process.argv` 实现了一次性 CLI：用户运行命令时传入一句话，程序调用模型后退出。

本章把它改造成**交互式 CLI**：

```text
程序启动后等待输入
  ↓
用户输入一句话
  ↓
程序调用 DeepSeek
  ↓
AI 回复像打字一样逐段显示
  ↓
程序继续等待下一次输入
```

同时会学到：

- `readline/promises` 交互循环
- 退出条件设计
- 命令与参数解析
- 流式输出原理与实现

---

## 1. 为什么需要交互式 CLI

`process.argv` 方式适合"一句话任务"：

```bash
npm run dev "总结一下 README"
```

但它有两个缺点：

1. **每说一句话就要重新启动程序**，效率低。
2. **无法保留多轮对话上下文**，每次运行都是新的进程。

交互式 CLI 让程序一直运行，用户可以连续输入、连续对话。

---

## 2. 用 readline 实现循环输入

Node.js 内置了 `readline/promises` 模块，可以方便地读取终端输入。

### 2.1 基本用法

```ts
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

const answer = await rl.question("请输入：");
console.log("你输入了：", answer);

rl.close();
```

`rl.question()` 会暂停程序，等待用户输入并按回车。

### 2.2 循环读取

把 `rl.question()` 放进 `while` 循环，就能实现持续交互：

```ts
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

async function main() {
  while (true) {
    const userInput = await rl.question("> ");
    console.log("收到:", userInput);
  }
}

main();
```

### 2.3 退出条件

上面的代码是死循环，需要通过输入特定命令退出：

```ts
async function main() {
  let running = true;

  while (running) {
    const userInput = await rl.question("请输入命令（exit 退出）：");

    if (userInput == null) {
      console.log("EOF，退出");
      running = false;
      continue;
    }

    const input = userInput.trim();

    if (input === "exit" || input === "quit") {
      console.log("再见！");
      running = false;
      continue;
    }

    if (input === "") continue;

    console.log("收到:", input);
  }

  rl.close();
}

main();
```

退出条件有三种：

| 情况 | 说明 |
|------|------|
| `userInput == null` | 用户按 `Ctrl+D`，发送 EOF |
| `exit` / `quit` | 用户输入退出命令 |
| `running = false` | 标志位控制循环结束 |

---

## 3. 命令与参数解析

用户输入可能包含命令和参数：

```text
请输入命令：echo hello world
请输入命令：add 10 20
```

可以用解构把字符串拆分：

```ts
const [command, ...args] = input.split(/\s+/);
```

| 输入 | `command` | `args` |
|------|-----------|--------|
| `help` | `"help"` | `[]` |
| `echo hello` | `"echo"` | `["hello"]` |
| `add 1 2` | `"add"` | `["1", "2"]` |

后续可以结合 `switch` 处理不同命令：

```ts
switch (command) {
  case "echo":
    console.log(args.join(" "));
    break;
  case "add":
    console.log(Number(args[0]) + Number(args[1]));
    break;
  default:
    console.log("未知命令:", command);
}
```

---

## 4. 在交互式 CLI 中调用 DeepSeek

把前面学到的内容组合起来：

1. 循环读取用户输入
2. 把用户输入加入 `messages`
3. 调用 DeepSeek
4. 打印 AI 回复
5. 把 AI 回复加入 `messages`

```ts
import { config } from "./config";
import type { ChatMessage } from "./types";
import { DeepSeek } from "./service/index";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

async function main() {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是一个命令行agent!",
    },
  ];

  function addMsg(msg: ChatMessage) {
    messages.push(msg);
  }

  let running = true;

  while (running) {
    const userInput = await rl.question("请输入命令（exit 退出）：");

    if (userInput == null) {
      console.log("EOF，退出");
      running = false;
      continue;
    }

    const input = userInput.trim();

    if (input === "exit" || input === "quit") {
      console.log("再见！");
      running = false;
      continue;
    }

    if (input === "") continue;

    // 1. 先加用户消息
    addMsg({ role: "user", content: input });

    // 2. 调用 DeepSeek
    const aiMsg = await DeepSeek(messages);

    // 3. 打印回复
    console.log("AI:", aiMsg);

    // 4. 把 AI 回复加入历史
    addMsg({ role: "assistant", content: aiMsg });
  }

  rl.close();
}

main();
```

注意顺序：**先加 user 消息，再调用模型**，否则模型看不到用户输入。

---

## 5. 流式输出

### 5.1 什么是流式输出

普通输出：等模型把所有内容生成完，一次性显示。

流式输出：模型生成一点，程序显示一点，像打字一样。

效果对比：

```text
普通输出：[等待 3 秒] 你好，我是 DeepSeek。
流式输出：你 好 ， 我 是   D e e p S e e k 。
```

### 5.2 核心原理

流式输出有三个关键步骤：

1. 请求时开启 `stream: true`
2. 用 `reader.read()` 逐段读取响应
3. 每收到一段内容，立刻打印

### 5.3 服务器返回的 SSE 格式

DeepSeek 流式接口使用 **SSE（Server-Sent Events）** 格式：

```text
data: {"choices":[{"delta":{"content":"你"}}]}

data: {"choices":[{"delta":{"content":"好"}}]}

data: [DONE]
```

每一行 `data:` 后面都是一个 JSON 片段，需要从 `choices[0].delta.content` 取出内容。

### 5.4 改造 DeepSeek 函数

让 `DeepSeek` 支持一个 `onChunk` 回调：

```ts
export async function DeepSeek(
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void
) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  let fullContent = "";
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const data = JSON.parse(jsonStr);
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk?.(content);
        }
      } catch {
        // 忽略解析失败的行
      }
    }
  }

  return fullContent;
}
```

### 5.5 在 main 中流式打印

```ts
process.stdout.write("AI: ");

const aiMsg = await DeepSeek(messages, (chunk) => {
  process.stdout.write(chunk);
});

process.stdout.write("\n");

addMsg({ role: "assistant", content: aiMsg });
```

用 `process.stdout.write` 而不是 `console.log`，因为 `console.log` 会自动换行。

---

## 6. 完整代码

### src/service/index.ts

```ts
import { ChatMessage } from "../types";
import { config } from "../config";

export async function DeepSeek(
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void
) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  let fullContent = "";
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") continue;

      try {
        const data = JSON.parse(jsonStr);
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk?.(content);
        }
      } catch {
        // 忽略解析失败的行
      }
    }
  }

  return fullContent;
}
```

### src/index.ts

```ts
import { config } from "./config";
import type { ChatMessage } from "./types";
import { DeepSeek } from "./service/index";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const rl = readline.createInterface({ input, output });

async function main() {
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是一个命令行agent!",
    },
  ];

  function addMsg(msg: ChatMessage) {
    messages.push(msg);
  }

  let running = true;

  while (running) {
    const userInput = await rl.question("请输入命令（exit 退出）：");

    if (userInput == null) {
      console.log("EOF，退出");
      running = false;
      continue;
    }

    const input = userInput.trim();

    if (input === "exit" || input === "quit") {
      console.log("再见！");
      running = false;
      continue;
    }

    if (input === "") continue;

    addMsg({ role: "user", content: input });

    process.stdout.write("AI: ");
    const aiMsg = await DeepSeek(messages, (chunk) => {
      process.stdout.write(chunk);
    });
    process.stdout.write("\n");

    addMsg({ role: "assistant", content: aiMsg });
  }

  rl.close();
}

main();
```

---

## 7. 常见问题

### Q1: 输入后没有再次提示"请输入命令"

多半是 `rl.question` 用法不对。`node:readline/promises` 的 `rl.question` 已经返回 Promise，不需要再包一层 `new Promise`。

错误：

```ts
function askQuestion(prompt: string) {
  rl.question(prompt, (answer) => {
    return answer;
  });
}
```

正确：

```ts
const answer = await rl.question(prompt);
```

### Q2: 模型回复的是 system prompt，而不是我的输入

检查顺序是否正确：

```ts
// ✅ 正确
addMsg({ role: "user", content: input });
const aiMsg = await DeepSeek(messages);

// ❌ 错误
const aiMsg = await DeepSeek(messages);
addMsg({ role: "user", content: input });
```

### Q3: 流式输出为什么中间有换行

检查是否用了 `console.log`：

```ts
// ❌ 每段都会换行
onChunk?.(content);
console.log(content);

// ✅ 连续追加
process.stdout.write(content);
```

### Q4: 中文字符显示乱码

解码时加上 `{ stream: true }`：

```ts
const chunk = decoder.decode(value, { stream: true });
```

这样可以正确处理一个中文字符被切分到两个 chunk 的情况。

---

## 8. 本章验收

完成本章后，你应该能：

- 用 `readline/promises` 实现交互式命令行循环。
- 设计合理的退出条件（`exit`、`quit`、EOF）。
- 把用户输入解析成 `command` 和 `args`。
- 在交互式循环中调用 DeepSeek API。
- 实现流式输出，让 AI 回复逐段显示。
- 把流式输出的完整内容保存到 `messages` 历史记录。

---

## 下一章预告

本章直接在 `index.ts` 里调用了 `DeepSeek(messages)`。下一章会把这段调用封装成统一的 `LLMClient`，让调用方不需要关心具体是 DeepSeek 还是其他模型。
