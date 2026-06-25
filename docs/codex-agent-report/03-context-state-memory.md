# 03. 上下文、状态与记忆

## 1. 上下文的组成

Codex 每轮推理时的上下文通常包括：

- 系统和开发者指令。
- 当前用户请求。
- 历史对话片段或压缩摘要。
- 工具调用结果。
- 相关文件内容。
- `AGENTS.md` 和项目配置。
- 被触发 skill 的 `SKILL.md` 正文。
- 必要的 reference 文件。
- MCP 资源或外部工具返回值。

这些内容共同决定模型“此刻知道什么”。

## 2. 历史不是无限原文保留

长线程会遇到上下文窗口限制。Codex 会依赖压缩、摘要和选择性加载，而不是永久逐字保留全部历史。工程上可以理解为：

```text
旧上下文 -> 压缩摘要 / 任务状态 -> 后续轮次继续使用
```

这意味着关键规则应该写入稳定位置，例如：

- `AGENTS.md`
- skill 文档
- 项目 docs
- config
- 明确的当前用户指令

不要只依赖很久以前的聊天内容。

## 3. 本地状态目录

本机 `.codex` 目录显示 Codex 保存了多种状态：

```text
.codex/
  config.toml
  history.jsonl
  session_index.jsonl
  sessions/
  archived_sessions/
  logs_2.sqlite
  state_5.sqlite
  memories_1.sqlite
  goals_1.sqlite
  memories/
  skills/
  plugins/
  browser/
  computer-use/
  node_repl/
  cache/
```

这些文件名说明 Codex 在本地维护：

- 配置；
- 会话索引；
- 历史记录；
- 日志；
- memory 数据库；
- goal 状态；
- 插件缓存；
- 浏览器和 computer-use 相关状态；
- node_repl 运行环境状态。

注意：报告没有读取认证密钥内容，也不应把 auth、token、cookie 等敏感信息写入分析文档。

## 4. Memory 层

Codex memories 是一个可选的本地回忆层，用于保存跨线程有用的偏好、项目习惯或长期事实。它不是高优先级指令源，显式用户指令和项目规则应优先。

工程理解：

```text
memory = 本地长期偏好/事实缓存
不是 = 当前任务唯一真相源
```

## 5. State 和 Logs

本机存在多个 SQLite 文件，例如：

- `logs_2.sqlite`
- `state_5.sqlite`
- `memories_1.sqlite`
- `goals_1.sqlite`

推断这些数据库分别支撑日志、全局状态、记忆和目标追踪。由于未读取 schema 和内容，本报告不对内部表结构做断言。

## 6. 对 agent-tui 的启发

如果要实现类似 agent runtime，建议显式区分：

- ephemeral context：当前轮上下文，可被压缩。
- durable instructions：项目级和用户级长期规则。
- task state：当前任务计划、待办、阻塞点。
- tool traces：工具调用、参数、输出、错误。
- memories：跨任务偏好和事实。
- cache：插件、模型列表、外部资源索引。

不要把这些全部混在一个 history 表里，否则后续权限、清理、压缩和可解释性都会变差。