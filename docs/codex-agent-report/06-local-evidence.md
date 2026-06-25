# 06. 本地证据清单

## 1. `.codex` 顶层目录

本机 `.codex` 目录包含以下关键项：

```text
.sandbox/
.sandbox-bin/
.sandbox-secrets/
.tmp/
ambient-suggestions/
archived_sessions/
attachments/
browser/
cache/
computer-use/
memories/
node_repl/
packages/
plugins/
process_manager/
sessions/
skills/
sqlite/
tmp/
vendor_imports/
AGENTS.md
auth.json
config.toml
history.jsonl
session_index.jsonl
logs_2.sqlite
state_5.sqlite
memories_1.sqlite
goals_1.sqlite
models_cache.json
version.json
```

## 2. 配置摘录

非敏感配置结构显示：

```toml
model_provider = "OpenAI"
model = "gpt-5.5"
model_reasoning_effort = "high"
model_context_window = 1000000
model_auto_compact_token_limit = 900000
sandbox_mode = "workspace-write"

[windows]
sandbox = "elevated"

[sandbox_workspace_write]
network_access = true

[mcp_servers.node_repl]
command = '...\node_repl.exe'
args = []

[plugins."browser@openai-bundled"]
enabled = true

[plugins."chrome@openai-bundled"]
enabled = true
```

含义：

- 模型和 reasoning effort 可配置。
- 上下文窗口和自动压缩阈值可配置。
- 沙箱模式和网络权限可配置。
- MCP server 通过 config 注册。
- plugin 可按 marketplace/name 启用。

## 3. Skills 结构

```text
.codex/skills/.system/
  imagegen/
  openai-docs/
  plugin-creator/
  skill-creator/
  skill-installer/

.codex/skills/coding/
  SKILL.md
  agents/openai.yaml
  references/coding-workflow.md
  references/standards.md
  scripts/create_analysis_doc.py

.codex/skills/feature-development/
  SKILL.md
  agents/openai.yaml
  references/feature-splitting.md
```

这验证了 skill 的标准结构：`SKILL.md`、可选 `agents/openai.yaml`、`references/`、`scripts/`。

## 4. Plugins 结构

```text
.codex/plugins/.plugin-appserver/
  codex.exe
  codex-command-runner.exe
  codex-windows-sandbox-setup.exe

.codex/plugins/cache/openai-bundled/browser/<version>/
  .codex-plugin/plugin.json
  skills/
  docs/
  scripts/
  assets/

.codex/plugins/cache/openai-bundled/chrome/<version>/
  .codex-plugin/plugin.json
  skills/
  assets/
```

含义：

- plugin 有本地缓存和版本化目录。
- bundled plugin 包含 manifest、skills、docs、scripts、assets。
- appserver 目录包含 Windows 执行组件和 sandbox helper。

## 5. Browser plugin manifest 证据

Browser plugin manifest 显示：

- `name`: browser
- `version`: 26.616.81150
- `skills`: `./skills/`
- `interface.displayName`: Browser
- `capabilities`: Interactive, Read, Write
- 目标：控制 Codex in-app browser，主要用于 localhost、127.0.0.1、file URL 等本地开发页面。

## 6. Chrome plugin manifest 证据

Chrome plugin manifest 显示：

- `name`: chrome
- `version`: 26.616.81150
- `skills`: `./skills/`
- `capabilities`: Interactive, Read
- 目标：使用用户 Chrome 现有状态，例如 tabs、logged-in sessions、cookies、extensions。

这解释了 Browser 和 Chrome 的权限差异：Chrome 插件读用户真实浏览器状态，敏感性更高。

## 7. 不读取的敏感内容

本报告没有读取或输出：

- `auth.json` 内容；
- cookie、token、session secret；
- sqlite 数据库中的私有日志内容；
- 浏览器个人数据；
- API key 或认证材料。

逆向分析应以结构为主，不应导出敏感运行数据。