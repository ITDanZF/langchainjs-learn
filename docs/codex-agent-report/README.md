# Codex Agent 系统工程逆向报告

生成时间：2026-06-25

## 说明

本文档是基于公开 OpenAI Codex 文档、当前会话可见能力、本机 `.codex` 目录结构和本地插件/skill/config 文件进行的工程化逆向分析。它不是 OpenAI 内部源码审计，也不声称覆盖未公开实现细节。

Codex manual helper 在本机尝试拉取 `https://developers.openai.com/codex/codex-manual.md` 时返回 HTTP 403，因此本文采用官方页面和本地可验证证据交叉分析。对无法从公开文档或本地文件确认的部分，报告中会标注为推断。

## 文件索引

- [01-system-map.md](01-system-map.md)：Codex agent 系统总览和分层架构。
- [02-runtime-flow.md](02-runtime-flow.md)：一次任务从用户输入到工具执行的运行链路。
- [03-context-state-memory.md](03-context-state-memory.md)：上下文、压缩、本地历史、memory 和状态存储。
- [04-extension-system.md](04-extension-system.md)：AGENTS.md、skills、plugins、MCP、hooks、subagents 的扩展机制。
- [05-sandbox-permissions.md](05-sandbox-permissions.md)：沙箱、权限、审批和工具安全边界。
- [06-local-evidence.md](06-local-evidence.md)：本机 `.codex` 目录和插件缓存证据。
- [07-agent-tui-design-notes.md](07-agent-tui-design-notes.md)：对 `agent-tui` 设计的启发和建议。
- [sources.md](sources.md)：官方来源和本地证据清单。

## 核心结论

Codex 的 agent 系统可以理解为一个多层执行系统：

```text
用户意图
  -> 会话/线程上下文
  -> 全局与项目指令
  -> 技能/插件/MCP/浏览器等能力发现
  -> 模型规划与工具选择
  -> 沙箱和审批层
  -> 本地或远程工具执行
  -> 结果回写上下文与状态
```

它不是单一 prompt，也不是单一工具调用器。更接近一个由上下文编排、能力注册、安全策略、工具执行和状态持久化组成的 agent runtime。