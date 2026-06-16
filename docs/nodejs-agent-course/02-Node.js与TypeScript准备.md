# 02. Node.js 与 TypeScript 准备

## 初始化项目

本课程示例使用 Node.js 20+ 和 npm。先确认本机环境：

```bash
node -v
npm -v
```

如果还没有安装 Node.js，建议安装 Node.js LTS 版本。安装完成后重新打开终端，再执行上面的命令确认版本。

如果你是在当前仓库里继续学习，可以直接进入已有示例目录：

```bash
cd mini-agent
npm install
```

如果你想从零创建一个新项目，可以执行：

```bash
mkdir node-agent-demo
cd node-agent-demo
npm init -y
```

## 安装依赖

运行时依赖：

```bash
npm install zod dotenv execa fast-glob
```

开发依赖：

```bash
npm install -D typescript tsx @types/node
```

这些依赖的作用：

- `zod`：定义和校验工具参数 schema。
- `dotenv`：读取 `.env` 环境变量。
- `execa`：后续执行命令行工具时使用。
- `fast-glob`：后续搜索文件时使用。
- `typescript`：TypeScript 编译器。
- `tsx`：开发阶段直接运行 `.ts` 文件。
- `@types/node`：Node.js API 的类型定义。

## 初始化 TypeScript

```bash
npx tsc --init
```

创建源码目录和入口文件：

```bash
mkdir src
echo console.log("hello world") > src/index.ts
```

## package.json

把 `package.json` 里的关键字段改成下面这样：

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

如果原文件里已经有 `name`、`version`、`license` 等字段，可以保留，只需要补上 `type` 和 `scripts`。

## tsconfig.json

建议配置：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist"
  },
  "include": ["src"]
}
```

## 环境变量

创建 `.env`：

```bash
LLM_API_KEY=your_api_key_here
LLM_MODEL=your_model_name_here
```

创建 `src/config.ts`：

```ts
import "dotenv/config";

export const config = {
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmModel: process.env.LLM_MODEL ?? "default-model",
};
```

## 为什么要用 TypeScript

Agent 项目会出现大量结构化数据：

- 消息。
- 工具调用。
- 工具参数。
- 工具返回值。
- 状态。
- 权限决策。

TypeScript 可以让这些边界更清楚，减少运行时错误。

## 本章验收

完成后运行：

```bash
npm run dev
npm run build
```

如果能看到 `hello world`，并且 `npm run build` 没有 TypeScript 报错，说明环境准备完成。

常见问题：

- `tsx` 不是内部或外部命令：通常是还没有运行 `npm install`，或开发依赖没有安装成功。
- `Cannot find module`：确认依赖已经写入 `package.json`，并且当前终端在项目目录中。
- `node` 或 `npm` 命令不存在：需要先安装 Node.js，并重新打开终端。

