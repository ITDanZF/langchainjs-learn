# 04. 扩展系统：AGENTS、Skills、Plugins、MCP、Hooks、Subagents

## 1. 扩展面总览

Codex 的扩展系统不是单点设计，而是多个作用域不同的机制：

| 机制 | 适用范围 | 主要用途 |
| --- | --- | --- |
| Prompt / thread context | 当前任务 | 一次性约束和目标 |
| `AGENTS.md` | 仓库或目录 | 持久工程规范、命令、测试方式 |
| `config.toml` | 全局或项目 | 模型、沙箱、MCP、插件、策略 |
| Skill | 可复用任务流程 | 专门工作流、参考资料、脚本 |
| Plugin | 可分发能力包 | skills、MCP、apps、assets、hooks 的组合 |
| MCP server | 工具和资源协议 | 外部系统、私有数据、动态能力 |
| Hook | 生命周期检查 | 命令、文件编辑、工具调用前后的约束 |
| Subagent | 委托执行 | 并行或专业子任务 |

## 2. AGENTS.md

`AGENTS.md` 是仓库或目录级的长期指令面，适合写：

- 构建命令；
- 测试命令；
- 代码规范；
- 审查要求；
- 目录特定规则；
- 禁止事项。

它比普通聊天更稳定，比 skill 更贴近具体项目。

## 3. Skill

Skill 是一个目录，核心文件是 `SKILL.md`。本机可见结构：

```text
.codex/skills/
  .system/
    openai-docs/
    skill-creator/
    plugin-creator/
    imagegen/
  coding/
    SKILL.md
    references/
    scripts/
    agents/openai.yaml
  feature-development/
    SKILL.md
    references/
    agents/openai.yaml
```

Skill 的关键设计是渐进加载：

1. 初始只暴露 `name` 和 `description` 等元数据。
2. 当用户点名或任务匹配时，读取 `SKILL.md` 正文。
3. 只有需要时才读取 `references/` 或运行 `scripts/`。

这让 Codex 能安装很多 skill，而不会把所有内容一次性塞进上下文。

## 4. Plugin

Plugin 是更适合分发的能力包。本机 bundled plugin manifest 显示：

```text
.codex/plugins/cache/openai-bundled/browser/<version>/.codex-plugin/plugin.json
.codex/plugins/cache/openai-bundled/chrome/<version>/.codex-plugin/plugin.json
```

plugin.json 中包含：

- name / version / description；
- author / homepage / repository / license；
- keywords；
- skills 路径；
- interface 元数据；
- icon、logo、defaultPrompt；
- capabilities。

这说明 plugin 不只是 skill，它还包含 UI 元数据、资源、脚本和可能的应用/工具集成。

## 5. MCP

MCP server 是工具和资源接入层。本机 `config.toml` 显示启用了：

```toml
[mcp_servers.node_repl]
command = '...\node_repl.exe'
args = []
```

当前会话也暴露了 `mcp__node_repl__js` 等工具。工程上，MCP 可以视为：

```text
外部能力进程 -> MCP 协议 -> Codex tool registry -> 模型可调用工具
```

这让 Codex 不需要把所有工具内置到核心程序里。

## 6. Browser / Chrome 插件

本机 bundled plugins 中启用了：

```toml
[plugins."browser@openai-bundled"]
enabled = true

[plugins."chrome@openai-bundled"]
enabled = true
```

Browser plugin 面向 Codex 内置浏览器，适合本地开发页面、localhost、file URL 等。Chrome plugin 面向用户已有 Chrome 状态，适合需要登录态、已有标签页或扩展的任务。

两者体现了同一个能力分类原则：

- in-app browser：更可控、更适合开发验证。
- user Chrome：更强但更敏感，需要更谨慎的权限和确认。

## 7. Subagents

官方文档提供 subagents 概念。工程上可以把 subagent 看作一个受主 agent 调度的子执行单元，用于：

- 并行调查；
- 独立验证；
- 专业领域任务；
- 减少主上下文污染。

但 subagent 也需要安全边界：不能泄漏不必要上下文，不能绕过主线程审批，不能替代用户确认。

## 8. Hook

Hook 适合做生命周期约束，例如：

- 命令执行前检查；
- 文件编辑前后检查；
- 禁止危险操作；
- 强制格式化或审计；
- 将某些行为升级为审批。

从 agent runtime 设计看，hook 是把“软规则”变成“机械约束”的关键机制。