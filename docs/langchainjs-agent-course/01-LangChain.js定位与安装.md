# 01. 项目初始化：把 mini-agent-langchain 变成 CLI 工程

## 本章目标

本章从你已经创建的 `mini-agent-langchain` 目录开始，搭建企业项目最小骨架。

完成后可以运行：

```bash
npm run dev -- ask "你好"
```

## 1. 进入项目目录

```bash
cd mini-agent-langchain
```

当前项目可能只有：

```text
package.json
src/index.ts
```

我们会把它改造成标准 TypeScript CLI 项目。

## 2. 安装依赖

开发依赖：

```bash
npm install -D typescript tsx @types/node vitest
```

运行依赖：

```bash
npm install langchain @langchain/core @langchain/openai @langchain/langgraph zod dotenv commander
```

依赖职责：

| 依赖 | 用途 |
| --- | --- |
| `langchain` | Agent、工具、结构化输出等高层 API |
| `@langchain/core` | 消息、Prompt、Runnable 等核心类型 |
| `@langchain/openai` | OpenAI 兼容模型接入 |
| `@langchain/langgraph` | 状态图、记忆、检查点 |
| `commander` | CLI 子命令 |
| `zod` | 配置和工具参数校验 |
| `dotenv` | 加载 `.env` |
| `vitest` | 单元测试 |

## 3. package.json

把 `package.json` 调整为：

```json
{
  "name": "mini-agent-langchain",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "mini-agent": "./dist/cli.js"
  },
  "scripts": {
    "dev": "tsx src/cli.ts",
    "build": "tsc",
    "start": "node dist/cli.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@langchain/core": "latest",
    "@langchain/langgraph": "latest",
    "@langchain/openai": "latest",
    "commander": "latest",
    "dotenv": "latest",
    "langchain": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "tsx": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

实际项目里建议锁定版本；教程中用 `latest` 是为了表达依赖集合。

## 4. tsconfig.json

创建 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src", "tests"]
}
```

LangChain.js 生态以 ESM 为主，所以项目使用 `type: module` 和 `NodeNext`。

## 5. 创建目录

```bash
mkdir -p src/{cli,config,models,prompts,chains,tools,agents,graph,memory,rag,evals,observability,utils}
```

建议先删除或不再使用 `src/index.ts`，改用 `src/cli.ts` 作为命令入口。

## 6. 环境变量模板

创建 `.env.example`：

```bash
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
AGENT_WORKSPACE=.
LOG_LEVEL=info
```

本地复制：

```bash
cp .env.example .env
```

## 7. 配置模块

创建 `src/config/env.ts`：

```ts
import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  DEEPSEEK_API_KEY: z.string().min(1, "DEEPSEEK_API_KEY is required"),
  DEEPSEEK_MODEL: z.string().default("deepseek-chat"),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  AGENT_WORKSPACE: z.string().default("."),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const env = EnvSchema.parse(process.env);
```

企业项目中，配置必须集中校验，不能散落在业务代码里读取 `process.env`。

## 8. CLI 入口

创建 `src/cli.ts`：

```ts
#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();

program
  .name("mini-agent")
  .description("Enterprise-ready Agent CLI built with LangChain.js")
  .version("0.1.0");

program
  .command("ask")
  .description("Ask a single question")
  .argument("<input...>", "question text")
  .action(async (input: string[]) => {
    console.log(`收到问题：${input.join(" ")}`);
  });

program
  .command("run")
  .description("Run an agent task")
  .argument("<task...>", "task text")
  .action(async (task: string[]) => {
    console.log(`收到任务：${task.join(" ")}`);
  });

program
  .command("chat")
  .description("Start an interactive session")
  .action(async () => {
    console.log("chat will be implemented in chapter 07");
  });

await program.parseAsync(process.argv);
```

## 9. 验收

```bash
npm run dev -- ask "你好"
```

预期输出：

```text
收到问题：你好
```

本章只是搭骨架。下一章会接入真实模型，让 `ask` 命令返回大模型答案。
