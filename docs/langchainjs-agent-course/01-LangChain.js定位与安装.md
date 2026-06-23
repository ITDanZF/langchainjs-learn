# 01. 项目初始化：只做一个最小 CLI

## 本章目标

本章从你已经创建的 `mini-agent-langchain` 目录开始，只完成一个可运行的 TypeScript CLI。

完成后可以运行：

```bash
npm run dev -- ask "你好"
```

本章不会接入大模型，也不会提前创建 Agent、Graph、RAG、测试等目录。那些能力会在真正需要时逐章加入。

## 1. 当前项目状态

进入项目目录：

```bash
cd mini-agent-langchain
```

当前项目可能只有：

```text
package.json
src/main.ts
```

本章只把它改造成：

```text
mini-agent-langchain/
  package.json
  tsconfig.json
  src/
    main.ts
    utils/
      input.ts
```

## 2. 安装本章依赖

开发依赖：

```bash
npm install -D typescript tsx @types/node
```

运行依赖：

```bash
npm install commander
```

本章暂时不安装：

```text
@langchain/openai
@langchain/core
@langchain/langgraph
langchain
dotenv
zod
vitest
```

原因很简单：第 01 章还用不到它们。等第 02 章接模型、第 06 章接 LangGraph、第 10 章补测试时再安装。

## 3. package.json

把 `package.json` 调整为类似下面的结构。依赖版本以你本地 `npm install` 生成的结果为准：

```json
{
  "name": "mini-agent-langchain",
  "version": "0.1.0",
  "description": "A mini Agent CLI built step by step with LangChain.js",
  "private": true,
  "type": "module",
  "main": "./dist/main.js",
  "types": "./dist/main.d.ts",
  "bin": {
    "mini-agent": "./dist/main.js"
  },
  "scripts": {
    "dev": "tsx src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "commander": "安装后由 npm 生成"
  },
  "devDependencies": {
    "@types/node": "安装后由 npm 生成",
    "tsx": "安装后由 npm 生成",
    "typescript": "安装后由 npm 生成"
  }
}
```

注意几点：

- `type: "module"` 保留，因为后续 LangChain.js 示例使用 ESM。
- `dev` 脚本直接运行 `src/main.ts`，适合课程阶段快速调试。
- `bin.mini-agent` 指向构建后的 `dist/main.js`，第 11 章发布 CLI 时会用到。
- 本章不加入 `test`、`check`、`eval`，避免把后续章节的能力提前塞进来。

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
  "include": ["src"]
}
```

后续第 10 章加入测试时，再把 `tests` 放进 `include`。

## 5. 输入工具

创建 `src/utils/input.ts`：

```ts
export function joinArgs(args: string[]) {
  return args.join(" ").trim();
}

export function ensureInput(input: string, message = "请输入内容") {
  if (input.length > 0) return true;

  console.error(message);
  process.exitCode = 1;
  return false;
}
```

这个小工具会在后续 `ask`、`run`、`chat` 等命令里复用。

## 6. CLI 入口

创建 `src/main.ts`：

```ts
#!/usr/bin/env node
import { Command } from "commander";
import { ensureInput, joinArgs } from "./utils/input.js";

const program = new Command();

program
  .name("mini-agent")
  .description("A mini Agent CLI built step by step with LangChain.js")
  .version("0.1.0");

program
  .command("ask")
  .description("Ask a single question")
  .argument("<input...>", "question text")
  .action(async (input: string[]) => {
    const question = joinArgs(input);
    if (!ensureInput(question, "请输入问题")) return;

    console.log(`收到问题：${question}`);
  });

await program.parseAsync(process.argv);
```

如果项目里还有旧的 `src/index.ts` 或 `src/cli.ts`，本章开始可以不再使用它们。入口统一放到 `src/main.ts`。

## 7. 验收

运行：

```bash
npm run dev -- ask "你好"
```

预期输出：

```text
收到问题：你好
```

再运行：

```bash
npm run typecheck
npm run build
```

如果都通过，说明第一个小版本完成。

## 8. 本章小结

现在项目只有一个能力：CLI 能接收 `ask` 输入。

这看起来很小，但它是后续所有能力的入口。下一章会在这个入口后面接入真实模型，让 `ask` 从占位输出升级为大模型回答。
