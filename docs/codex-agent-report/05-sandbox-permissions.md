# 05. 沙箱、权限与审批

## 1. 沙箱的工程角色

Codex 的安全执行层负责把模型意图约束在可审计、可授权的范围内。它至少需要处理：

- 文件系统读写边界；
- 网络访问；
- GUI / 外部应用启动；
- destructive 命令；
- shell 特性和命令拆分；
- 用户审批；
- 插件和 MCP 工具权限。

## 2. 本机配置证据

本机 `config.toml` 中可见：

```toml
sandbox_mode = "workspace-write"

[windows]
sandbox = "elevated"

[sandbox_workspace_write]
network_access = true
```

这表示当前环境允许工作区写入，并允许网络访问，但 Windows 上还存在平台侧 sandbox helper / elevated 执行细节。

## 3. 实际观察到的失败模式

本会话多次遇到：

```text
windows sandbox: orchestrator_helper_launch_failed
codex-windows-sandbox-setup.exe ... program not found
```

这说明：

- shell 工具正常执行依赖 Windows sandbox helper；
- helper 缺失会让普通 sandbox 执行失败；
- 使用提升权限后可以绕过该具体失败；
- 这属于运行时环境问题，不是模型推理问题。

## 4. 审批策略

需要审批或特别谨慎的操作包括：

- 写入工作区外路径；
- GUI 应用启动，例如 VS Code、浏览器；
- 网络失败后的重试或外部下载；
- 删除、移动、重置等破坏性操作；
- 可能泄漏敏感信息的读取或输出；
- 插件访问用户浏览器状态。

## 5. 命令拆分

权限系统会按 shell 控制符拆分命令段，例如 pipe、`&&`、`;` 等。每个段独立评估。这能减少“一个被批准前缀包住危险后续命令”的风险。

## 6. 安全设计原则

对 agent-tui 来说，应借鉴以下原则：

- 读写权限显式建模，不要只靠 prompt 要求。
- shell 命令必须结构化审计。
- 外部应用和 GUI 操作单独授权。
- 网络和文件系统权限分开。
- 破坏性操作永远需要强确认。
- 工具返回值要进入 trace，便于回放和审计。
- 插件权限要可见、可禁用、可按 workspace 限制。

## 7. 不应依赖模型自律做安全边界

模型可以遵守规则，但安全边界必须由 runtime 强制。Prompt 适合表达偏好和流程，sandbox/approval 才适合表达硬约束。