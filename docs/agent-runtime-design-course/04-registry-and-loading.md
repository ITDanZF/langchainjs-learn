# 04. AgentRegistry 与加载设计

`AgentRegistry` 负责管理所有可用 agent。它不执行 agent，只负责注册、查询、覆盖和展示。

## Registry 的职责

`AgentRegistry` 应该负责：

```text
register(agent)
registerMany(agents)
get(id)
has(id)
list()
listActive()
resolve(id)
validate(agent)
```

它不应该负责：

```text
调用模型
执行工具
保存 memory
处理 CLI 输出
运行后台任务
```

## 第一阶段接口

建议类型：

```ts
export class AgentRegistry {
  private agents = new Map<string, AgentDefinition>();

  register(agent: AgentDefinition) {
    validateAgentDefinition(agent);
    this.agents.set(agent.id, agent);
  }

  registerMany(agents: AgentDefinition[]) {
    for (const agent of agents) {
      this.register(agent);
    }
  }

  get(id: string) {
    return this.agents.get(id);
  }

  list() {
    return Array.from(this.agents.values());
  }
}
```

第一阶段简单覆盖即可。后续如果要展示覆盖来源，再把 value 升级为：

```ts
type RegisteredAgent = {
  definition: AgentDefinition;
  source: "built-in" | "project" | "user" | "plugin";
  filePath?: string;
};
```

## 和当前 AgentManage 的区别

当前 `model/index.ts` 里的 `AgentManage` 管的是：

```text
AgentRuntime {
  id
  name
  model: Model
  status
}
```

这更像运行实例管理，不像定义注册表。

新的 `AgentRegistry` 管的是：

```text
AgentDefinition {
  id
  name
  description
  systemPrompt
  tools
}
```

区别很关键：

```text
AgentRegistry 管说明书
AgentRuntime 管执行过程
```

不要在 Registry 里创建 `new Model()`。

## built-in agent 加载

第一阶段可以只支持内置 agent：

```ts
export function createDefaultAgentRegistry() {
  const registry = new AgentRegistry();
  registry.registerMany(builtInAgents);
  return registry;
}
```

主程序启动时：

```ts
const agentRegistry = createDefaultAgentRegistry();
```

然后把 registry 注入给：

```text
AgentRuntime
delegate_task tool
CLI /agents 命令
```

## 项目级 agent 加载

第二阶段支持：

```text
mini-agent-langchain/.agents/*.md
```

加载流程：

```text
扫描 .agents 目录
读取 markdown 文件
解析 frontmatter
校验 AgentDefinition
注册到 registry
收集 failedFiles
```

失败时不要中断启动：

```ts
type LoadAgentsResult = {
  agents: AgentDefinition[];
  failedFiles: {
    path: string;
    error: string;
  }[];
};
```

## 覆盖来源

当后续有多个来源时，建议按这个顺序加载：

```text
built-in
project
user
plugin
runtime override
```

为什么项目 agent 应该能覆盖 built-in：

```text
项目最了解自己的技术栈
同名 code-reviewer 可以替换默认审查策略
团队可以定制自己的编辑规范
```

为什么插件 agent 不应该随便覆盖用户定义：

```text
插件是第三方分发物
用户显式配置应该有更高优先级
插件不能静默扩大权限
```

## 查询能力

主 agent 需要知道可用子 agent。可以提供：

```ts
registry.listForPrompt()
```

输出给 `delegate_task` 工具 description 使用：

```text
Available subagents:
- code-reviewer: Review code changes and find bugs.
- code-searcher: Locate files, symbols, and flows.
- file-editor: Make focused text edits.
```

这有助于模型正确选择 `subagent_type`。

## CLI 命令

后续可以增加：

```text
/agents
/agents show code-reviewer
/agents reload
```

第一阶段只需要 `/agents`：

```text
code-reviewer    Review code changes...
code-searcher    Locate files...
file-editor      Make focused edits...
```

这个命令只读 Registry，不执行 agent。

