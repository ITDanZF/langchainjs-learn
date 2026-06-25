# 07. 对 agent-tui 的设计建议

## 1. 建议的核心模块

如果 `agent-tui` 要实现类似 Codex 的 agent runtime，建议至少拆成这些模块：

```text
agent-tui/
  core/
    conversation/
    context/
    planner/
    tool-registry/
    policy/
    sandbox/
    approvals/
    state/
  extensions/
    skills/
    plugins/
    mcp/
    hooks/
  ui/
    tui/
    confirmations/
    traces/
  storage/
    sessions/
    logs/
    memories/
    cache/
```

## 2. 上下文系统

需要明确区分：

- 当前对话上下文；
- 压缩摘要；
- 项目规则；
- skill 规则；
- 工具返回；
- 长期 memory；
- 用户确认结果。

不要把所有内容简单拼成一个大 prompt。应有 context planner，负责选择、裁剪、排序和标注来源。

## 3. 工具系统

工具注册建议采用结构化 schema：

```text
tool {
  name
  description
  input_schema
  permissions
  side_effects
  timeout
  sandbox_requirements
  approval_policy
}
```

模型只看到可调用工具的抽象描述，runtime 负责执行和权限判断。

## 4. Skill 系统

可直接借鉴 Codex 的三层加载：

1. metadata：name、description，常驻上下文。
2. instruction：触发后读取主文档。
3. resources：需要时读取 references 或运行 scripts。

建议 skill 目录：

```text
skills/<skill-name>/
  SKILL.md
  agents/openai.yaml
  references/
  scripts/
  assets/
```

关键点：description 必须写清楚触发条件，因为主文档未触发前不会被模型看到。

## 5. Plugin 系统

plugin 应作为分发单元，不只是技能目录。建议 manifest：

```json
{
  "name": "browser",
  "version": "1.0.0",
  "description": "...",
  "skills": "./skills",
  "mcpServers": "./mcp.json",
  "hooks": "./hooks.json",
  "assets": "./assets",
  "interface": {
    "displayName": "Browser",
    "shortDescription": "...",
    "capabilities": ["Read", "Write", "Interactive"]
  }
}
```

## 6. 审批 UX

用户在前面要求的“一个问题 + 几个选项”很适合 agent-tui：

```text
需要你确认一个点：是否允许运行完整构建？

1. 跳过完整构建：最快，但只保留局部验证信心。
2. 运行局部测试：平衡速度和可信度。
3. 运行完整构建：最稳，但耗时更长。
```

审批对象应结构化存储：

- question；
- options；
- recommended option；
- selected option；
- timestamp；
- effect；
- whether it authorizes side effects。

## 7. 安全策略

建议把安全策略做成 runtime 层，而不是 prompt 层：

- 文件写入路径检查。
- 命令 allowlist / denylist。
- shell segment 拆分。
- 网络权限。
- GUI 权限。
- destructive operation 二次确认。
- secret redaction。
- trace 审计。

## 8. 状态存储

建议分表或分文件：

- `sessions`：线程、消息、摘要。
- `tool_calls`：工具名、参数、输出、exit code、耗时。
- `approvals`：用户确认记录。
- `memories`：长期偏好和事实。
- `skills_index`：skill metadata。
- `plugins_index`：plugin manifest 和启用状态。
- `workspace_state`：项目可信状态、AGENTS 解析结果。

## 9. 报告生成

对复杂任务，建议和当前 `coding` skill 一样：

- 轻量任务直接在 TUI 里给分析和选项。
- 复杂任务生成 Markdown 报告。
- 报告路径必须在 TUI 中展示。
- 外部编辑器打开只作为 best-effort。
- 需要确认的问题必须在 TUI 中交互，不只写在报告里。

## 10. 最小可行架构

MVP 可以先做：

1. 会话和工具调用 trace。
2. 本地文件读写工具。
3. shell 工具和 sandbox policy。
4. skill metadata 扫描与触发。
5. approval prompt 组件。
6. Markdown 报告生成。
7. session/history 持久化。

后续再加 plugin、MCP、hooks、subagents 和 memory。