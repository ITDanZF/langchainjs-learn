# 06. 工具权限模型

工具权限是 Agent Runtime 的安全核心。多 agent 系统中，不能让每个 agent 默认拥有全部工具。

## 基本原则

```text
默认最小权限
按 agent 分配工具
读写工具分级
写入前必须读
后台任务避免交互式权限提示
插件 agent 不得静默扩大权限
```

第一阶段重点是：

```text
tools 白名单
disallowedTools 黑名单
工具名注册表
读后写保护
```

## 当前工具

当前项目已有：

```text
read_file
write_file
edit_file
list_files
search_text
```

可以分级：

```text
readonly:
  read_file
  list_files
  search_text

write:
  edit_file
  write_file
```

后续如果增加 shell：

```text
execute_command
```

它应该是更高风险级别。

## ToolResolver

建议新增：

```ts
export class ToolResolver {
  constructor(private allTools: ToolDefinition[]) {}

  resolve(agent: AgentDefinition) {
    let tools = this.allTools;

    if (agent.tools?.length) {
      tools = tools.filter((tool) => agent.tools!.includes(tool.name));
    }

    if (agent.disallowedTools?.length) {
      tools = tools.filter((tool) => !agent.disallowedTools!.includes(tool.name));
    }

    return tools;
  }
}
```

第一阶段只做名字过滤即可。

## 工具注册表

不要让工具只以数组形式存在。建议有一个统一注册表：

```ts
export type ToolMetadata = {
  name: string;
  risk: "read" | "write" | "execute";
  description: string;
};
```

示例：

```ts
export const toolMetadata = {
  read_file: {
    risk: "read",
    description: "Read a text file inside the workspace.",
  },
  edit_file: {
    risk: "write",
    description: "Edit a text file by exact replacement.",
  },
};
```

这样校验 `AgentDefinition.tools` 时可以确认工具名存在。

## 白名单和黑名单

优先级：

```text
all tools
  -> apply tools whitelist
  -> apply disallowedTools blacklist
  -> apply runtime permission mode
```

例如：

```ts
{
  id: "code-reviewer",
  tools: ["read_file", "list_files", "search_text"],
}
```

reviewer 不能写文件。

例如：

```ts
{
  id: "safe-editor",
  tools: ["read_file", "edit_file", "write_file", "search_text"],
  disallowedTools: ["write_file"],
}
```

即使白名单里有 `write_file`，最后也会被黑名单排除。

## 读后写保护

当前 `edit_file` 和 `write_file` 已经有类似机制：

```text
existing files must be read first
assertFileFreshForWrite()
updateReadFileState()
```

这个设计应该继续保留，并逐步从全局状态演进到按 ExecutionContext 隔离。

目标：

```text
Agent A 读过 file.ts，不代表 Agent B 可以写 file.ts
主 agent 读过 file.ts，不代表子 agent 自动可以写 file.ts
```

后续可以把 readFileState 放入：

```text
ExecutionContext.readFileStateId
```

## Agent 类型的工具建议

### code-searcher

```text
list_files
search_text
read_file
```

不允许：

```text
edit_file
write_file
```

### code-reviewer

```text
read_file
search_text
list_files
```

不允许写文件。

### file-editor

```text
read_file
search_text
edit_file
write_file
```

要求：

```text
必须读文件后再写
尽量使用 edit_file
少用 write_file
```

### architect

```text
read_file
search_text
list_files
```

负责设计，不负责修改。

## 错误提示

当 agent 请求不存在工具：

```text
Unknown tool "shell". Registered tools: read_file, list_files, search_text, edit_file, write_file.
```

当工具被权限拒绝：

```text
Tool "edit_file" is not available to agent "code-reviewer".
Allowed tools: read_file, list_files, search_text.
```

错误提示要帮助用户修配置，而不是只说 forbidden。

## 未来权限模式

后续可以增加：

```text
readonly
acceptEdits
manualApproval
bypassPermissions
```

但第一阶段不要急。先把 per-agent tool list 做扎实。

