# Skill 系统设计文档（M1-M5）

本文档基于当前 `mini-agent-langchain` 项目的架构，设计一个从本地 Markdown Skill 到本地 Skill 市场/安装体系的演进路线。

目标阶段是做到 **M5：Skill 安装/市场**。为了避免一开始把复杂度做满，系统按 M1 到 M5 分阶段交付，每个阶段都能独立形成可用能力，并为下一阶段留下稳定扩展点。

## 1. 背景与定位

当前项目已经具备：

- CLI 会话系统。
- LangChain/LangGraph Agent 运行时。
- 文件工具体系。
- 工具审批策略。
- 内置子 Agent 注册表。
- 多 Agent 计划、调度、结果评审和答案汇总雏形。

Skill 系统不应该替代这些模块，而应该作为一个新的“能力说明层”接入现有运行时。

三者职责边界：

```txt
Tool
  真实可执行能力
  例如 read_file、write_file、search_text

Agent
  运行时角色
  例如 text-analyzer、text-reviewer

Skill
  面向任务领域的知识、流程、约束、输出格式、触发规则
  例如 新闻监控、代码审查、测试生成、PR 总结
```

核心原则：

- Skill 第一阶段是 **只读 Markdown 能力包**，不执行任意代码。
- Skill 不能绕过工具审批。
- Skill 可以增强主 Agent 的 system prompt。
- Skill 可以在声明后编译为子 Agent，参与 planner 和 `delegate_task`。
- Skill 需要可解释、可测试、可禁用、可安装、可更新。

## 2. 总体目标

最终做到 M5 时，用户应该可以：

```txt
1. 把一个 SKILL.md 放入 ./skills/<skill-id>/SKILL.md
2. CLI 自动加载并校验
3. 使用 /skills 查看可用技能
4. 使用 /skill-use <id> 在当前会话启用技能
5. 用户输入命中某个技能时自动注入技能上下文
6. 如果技能声明 agent.enabled=true，它会自动注册为子 Agent
7. 可以从本地 marketplace 安装、启用、禁用、更新技能
```

非目标：

- M1-M5 不支持 Skill 内执行 JS/TS 代码。
- M1-M5 不支持远程任意脚本安装。
- M1-M5 不把所有 Skill 一次性塞进 system prompt。
- M1-M5 不让 Skill 修改 `ToolPolicy` 的安全默认值。

## 3. 推荐目录结构

新增源码目录：

```txt
src/skills/
  SkillDefinition.ts
  SkillLoader.ts
  SkillRegistry.ts
  SkillResolver.ts
  SkillPrompt.ts
  SkillAgentCompiler.ts
  SkillApplication.ts
  SkillInstallService.ts
  SkillMarketplace.ts
  index.ts
```

新增测试目录：

```txt
tests/skills/
  SkillDefinition.test.ts
  SkillLoader.test.ts
  SkillRegistry.test.ts
  SkillResolver.test.ts
  SkillPrompt.test.ts
  SkillAgentCompiler.test.ts
  SkillApplication.test.ts
  SkillInstallService.test.ts
```

Skill 来源目录：

```txt
./skills/
  bundled default skills 源目录
  随 CLI/npm 包或未来桌面应用资源发布

~/.mini-agent/skills/system/
  启动后从 ./skills 同步出的 system runtime skills
  由系统管理，运行时从这里加载

~/.mini-agent/skills/user/
  用户创建或 M5 marketplace 安装的 Skill

~/.mini-agent/skills/cache/marketplace/
  M5 本地 marketplace 索引和缓存
```

说明：M0 会先把根目录 `./skills` 中的 bundled default skills 同步到 `~/.mini-agent/skills/system`。M1-M5 的运行时加载逻辑应该优先依赖用户数据目录，而不是直接把 `./skills` 当作可编辑运行目录。这个分层方便未来桌面应用把默认 Skill 放入只读 app resources，同时保留用户数据目录中的运行时副本。

## 4. Skill 文件格式

继续沿用 `SKILL.md`，但 frontmatter 需要规范化。

推荐格式：

```md
---
id: news-monitor
name: 新闻监控
version: 1
description: 监控金融新闻并分析市场影响。
triggers:
  - 新闻监控
  - 市场情绪
  - 价格影响分析
tools:
  - read_file
  - search_text
agent:
  enabled: true
  id: news-monitor
  name: News Monitor
  maxTurns: 6
  tools:
    - read_file
    - search_text
metadata:
  category: finance
  readOnly: true
---

# 新闻监控技能

## 何时使用

...

## 工作流程

...

## 输出格式

...
```

字段说明：

```txt
id
  必填。稳定唯一 ID。建议 kebab-case。

name
  必填。展示名。

version
  必填。整数版本。M5 用于安装和更新比较。

description
  必填。用于列表展示和自动匹配。

triggers
  可选。确定性触发关键词。

tools
  可选。Skill 希望使用的工具名称。不能提升权限，只用于校验和提示。

agent
  可选。声明该 Skill 是否可以编译为子 Agent。

metadata
  可选。分类、只读标记、作者、来源等扩展信息。
```

校验规则：

- `id` 必须匹配 `^[a-z0-9][a-z0-9_-]*$`。
- `name`、`description` 不能为空。
- `version` 必须是正整数。
- `triggers` 最多建议 20 个。
- `tools` 必须能被当前 `ToolResolver` 识别。
- `agent.tools` 必须是 `tools` 的子集，或者显式通过校验。
- Markdown body 不能为空。
- 同一来源内不能出现重复 `id`。

## 5. 运行时总流程

```txt
启动
  -> Bootstrap 初始化目录
  -> SkillBootstrap 同步 ./skills 到 ~/.mini-agent/skills/system
  -> SkillLoader 扫描 ~/.mini-agent/skills/system 和 ~/.mini-agent/skills/user
  -> SkillRegistry 注册并校验 Skill
  -> SkillAgentCompiler 把可编译 Skill 转成 AgentDefinition
  -> createAgentOrchestrator 合并 builtInAgents + skillAgents

用户输入
  -> SkillApplication 获取当前 thread 的手动启用 Skill
  -> SkillResolver 基于输入自动选择相关 Skill
  -> SkillPrompt 生成精简 skill context
  -> AgentGenerator 将 skill context 拼入 systemPrompt
  -> 主 Agent 运行
  -> 如果 planner 进入 planned mode，可选择 skill 编译出的子 Agent
```

Prompt 注入格式建议：

```txt
Active skills:

<skill id="news-monitor" name="新闻监控">
Use when: 监控金融新闻并分析市场影响。
Workflow:
1. ...
Output format:
...
</skill>
```

注入原则：

- 默认最多自动注入 2 个 Skill。
- 手动启用 Skill 优先级最高。
- 只注入摘要、触发说明、核心流程和输出格式。
- 不注入过长参考资料。
- 每个 Skill 注入内容建议限制在 1000-2000 字符。

## 6. M1：只读 Skill Loader

### 目标

让项目能够发现、解析、校验并展示本地 `SKILL.md`。

M1 不做自动触发，不注入 prompt，不编译 Agent。

### 用户能力

```txt
/skills
  查看所有已加载 Skill

/skill <id>
  查看某个 Skill 的详情

/skill-doctor
  检查 Skill 文件是否有效

/skill-reload
  重新扫描本地 Skill
```

### 需要实现的模块

```txt
SkillDefinition.ts
  定义 SkillManifest、SkillDefinition、SkillSource、SkillValidationError

SkillLoader.ts
  扫描目录、读取 SKILL.md、解析 frontmatter、返回 SkillDefinition[]

SkillRegistry.ts
  注册、去重、查询、列表展示

SkillApplication.ts
  给 CLI 提供 list/get/reload/doctor 用例
```

### Frontmatter 解析策略

为了避免一开始增加太多依赖，可以先实现一个简单 parser：

```txt
1. 判断文件是否以 --- 开头
2. 找到第二个 ---
3. 中间部分按 YAML-like 简单格式解析
4. body 是第二个 --- 后的 Markdown
```

如果后续字段复杂，再考虑引入 YAML parser。

### 接入点

- `Bootstrap.setup()` 后加载 Skill。
- `main.ts` 创建 `SkillApplication`，并传入 CLI command context。
- `CommandSet` 增加 `/skills`、`/skill`、`/skill-doctor`、`/skill-reload`。

### 验收标准

- 能加载 `skills/stock/SKILL.md`。
- 无效 frontmatter 能给出明确错误。
- 重复 `id` 能报错。
- 未知工具能报错或 warning。
- CLI 可以列出和查看 Skill。
- 不影响现有 `npm run check`。

### 测试重点

- 正常 Skill 解析。
- 缺字段失败。
- 重复 id 失败。
- body 为空失败。
- 目录不存在时返回空列表。
- `SkillApplication.reload()` 能更新 registry。

## 7. M2：自动触发与 Prompt 注入

### 目标

根据用户输入和会话状态，选择相关 Skill，并将 Skill 上下文注入主 Agent prompt。

### 用户能力

```txt
用户：帮我分析这条新闻对美股的影响
系统：自动命中 news-monitor skill
Agent：按 news-monitor 的流程输出分析
```

### 需要实现的模块

```txt
SkillResolver.ts
  输入用户 prompt，返回匹配的 SkillSelection[]

SkillPrompt.ts
  把 SkillDefinition[] 转成可注入的 prompt 片段

AgentGeneratorOptions
  新增 skillResolver、skillRegistry 或 skillContextProvider
```

### 选择策略

第一版使用确定性打分，不依赖 embedding：

```txt
手动启用 Skill
  +1000

id/name 精确命中
  +100

trigger 命中
  +80

description 关键词命中
  +30

Markdown 标题命中
  +10
```

规则：

- 默认选择分数最高的 2 个。
- 低于阈值不自动启用。
- 手动启用的 Skill 不受阈值限制。
- 如果多个 Skill 分数接近，可以在事件中记录 selection reason。

### Prompt 注入策略

`AgentGenerator` 当前有固定 `delegationPrompt`。M2 可以将其改成函数：

```txt
createMainSystemPrompt({ activeSkills })
  -> baseSystemPrompt
  -> delegate_task 说明
  -> skill context
```

注意：

- Skill context 只进入当前 run 的 system prompt。
- 不写入会话历史。
- 不改变 LangGraph checkpoint 的 thread id。
- 内部 planner/reviewer/synthesizer 默认不注入主 Agent Skill，除非 M3 后以 Agent 形式参与。

### 事件与可观测性

建议增加应用事件：

```txt
skill_selected
  runId
  threadId
  skills: [{ id, name, score, reason }]
```

CLI 可先简单渲染：

```txt
启用技能：news-monitor
```

### 验收标准

- 用户输入命中 trigger 后，system prompt 包含对应 Skill context。
- 未命中时不注入 Skill。
- 最多自动注入 2 个 Skill。
- 注入内容长度受限。
- 选择逻辑可单元测试。

### 测试重点

- trigger 命中。
- name/id 命中。
- description 关键词命中。
- 多 Skill 排序。
- 长 Markdown 被截断或摘要化。
- 无 Skill 时主 Agent 行为不变。

## 8. M3：Skill 编译为子 Agent

### 目标

让 Skill 不只增强主 Agent，也能成为可被 planner 和 `delegate_task` 调用的 specialist agent。

### 用户能力

```txt
用户：分析这份研报，提取新闻事件并判断可能影响的市场
planner：选择 news-monitor 子 Agent 执行相关任务
```

### 需要实现的模块

```txt
SkillAgentCompiler.ts
  SkillDefinition -> AgentDefinition

createAgentOrchestrator.ts
  合并 builtInAgents 和 skillAgents

AgentRegistry
  保持现有注册能力，增加来源 metadata 即可
```

### 编译规则

如果 Skill frontmatter 中有：

```yaml
agent:
  enabled: true
```

则编译为：

```ts
AgentDefinition {
  id: skill.agent.id ?? skill.id,
  name: skill.agent.name ?? skill.name,
  description: skill.description,
  systemPrompt: compileSkillSystemPrompt(skill),
  tools: skill.agent.tools ?? skill.tools ?? [],
  maxTurns: skill.agent.maxTurns ?? 6,
  metadata: {
    source: "skill",
    skillId: skill.id,
    category: skill.metadata.category,
    readOnly: skill.metadata.readOnly,
  }
}
```

`compileSkillSystemPrompt(skill)` 建议包含：

```txt
你是 <skill.name> 专家 Agent。

职责：
<description>

使用场景：
<何时使用 / triggers>

工作流程：
<workflow section>

输出格式：
<output format section>

限制：
1. 只基于可见上下文和工具结果回答。
2. 不要声称执行了未执行的操作。
3. 不要绕过工具权限。
```

### Planner 接入

当前 `TaskPlanner` 已经通过 `registry.list()` 构造 available agents。M3 只要确保 skill agents 注册进同一个 `AgentRegistry`，planner 就能看到。

需要注意：

- `description` 要简洁，否则 planner prompt 会变长。
- `metadata.readOnly=false` 的 Agent 暂时不要进入自动 planned mode，除非后续支持 side effect 计划。
- 当前 planned task schema 要求 `sideEffect: "none"`，因此 M3 建议只允许 read-only skill agent 进入 planner。

### `delegate_task` 接入

`delegate_task` 使用同一个 registry 展示 available subagents。Skill agent 注册后自然可用。

### 验收标准

- 带 `agent.enabled=true` 的 Skill 会出现在 `AgentRegistry.list()`。
- `delegate_task` 描述里能看到 skill agent。
- planner 能选择 skill agent。
- 未声明 agent 的 Skill 不注册为 Agent。
- 只读限制与 planned mode 的 `sideEffect: none` 一致。

### 测试重点

- Skill 到 AgentDefinition 的编译。
- 未知工具失败。
- agent id 冲突失败。
- readOnly=false 的 Skill 不进入 planner，或明确失败。
- planner available agents 包含 skill agent。

## 9. M4：会话级 Skill 状态

### 目标

允许用户在某个 thread 中固定启用或禁用 Skill，让 Skill 成为会话上下文的一部分。

### 用户能力

```txt
/skill-use news-monitor
  当前会话固定启用 news-monitor

/skill-clear
  清除当前会话手动启用的所有 Skill

/skill-disable news-monitor
  当前会话禁用自动命中的 news-monitor
```

### 数据模型

当前 thread 只保存基础信息和消息。M4 建议给 thread 增加 metadata。

```ts
type ThreadRecord = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  metadata?: {
    activeSkillIds?: string[];
    disabledSkillIds?: string[];
  };
};
```

JSON 存储建议：

```json
{
  "id": "thread-1",
  "title": "Market Research",
  "createdAt": "...",
  "updatedAt": "...",
  "metadata": {
    "activeSkillIds": ["news-monitor"],
    "disabledSkillIds": []
  }
}
```

### 需要实现的模块

```txt
ThreadApplication
  增加 setThreadMetadata / updateThreadSkills 相关用例

ThreadPersistence
  支持保存 thread metadata

SkillApplication
  useSkill、clearSkills、disableSkill、getThreadSkillState

CommandSet
  增加 /skill-use、/skill-clear、/skill-disable
```

### SkillResolver 行为

M4 后 resolver 输入需要包含 thread skill state：

```txt
manual activeSkillIds
  强制启用

disabledSkillIds
  自动匹配时排除

automatic matches
  作为补充
```

最终合并顺序：

```txt
1. 手动启用 Skill
2. 自动命中 Skill
3. 去重
4. 去掉 disabledSkillIds
5. 限制数量和 prompt 长度
```

### 验收标准

- `/skill-use <id>` 后当前 thread 每次 run 都启用该 Skill。
- 切换 thread 后 active skills 跟随 thread 改变。
- `/skill-clear` 只影响当前 thread。
- `/skill-disable <id>` 可以阻止自动命中。
- 旧 thread JSON 没有 metadata 时可以兼容读取。

### 测试重点

- thread metadata 读写。
- skill state 随 thread 切换。
- 手动启用优先于自动触发。
- disabled skill 排除自动结果。
- 旧 JSON 兼容。

## 10. M5：Skill 安装/市场

### 目标

支持从本地 marketplace 安装、更新、禁用、卸载 Skill，为未来远程 marketplace 留接口。

M5 的重点不是公网分发，而是建立安装协议、索引格式、版本管理和安全边界。

### 用户能力

```txt
/skill-market
  查看可安装 Skill

/skill-install <id>
  安装 Skill 到 ~/.mini-agent/skills/user/<id>

/skill-update <id>
  更新 Skill

/skill-remove <id>
  卸载用户安装的 Skill

/skill-enable <id>
  启用已安装 Skill

/skill-disable-global <id>
  全局禁用 Skill
```

### Marketplace 索引格式

M5 可以先支持本地 JSON 索引：

```json
{
  "version": 1,
  "skills": [
    {
      "id": "news-monitor",
      "name": "新闻监控",
      "version": 1,
      "description": "监控金融新闻并分析市场影响。",
      "category": "finance",
      "source": {
        "type": "local",
        "path": "./marketplace/news-monitor"
      },
      "entry": "SKILL.md",
      "checksum": "sha256:..."
    }
  ]
}
```

目录示例：

```txt
marketplace/
  index.json
  news-monitor/
    SKILL.md
    README.md
```

安装到：

```txt
~/.mini-agent/skills/user/news-monitor/
  SKILL.md
  README.md
  install.json
```

`install.json` 示例：

```json
{
  "id": "news-monitor",
  "version": 1,
  "installedAt": "2026-07-21T00:00:00.000Z",
  "source": {
    "type": "local",
    "path": "./marketplace/news-monitor"
  },
  "checksum": "sha256:...",
  "enabled": true
}
```

### 需要实现的模块

```txt
SkillMarketplace.ts
  读取 marketplace index、查询可安装 Skill、比较版本

SkillInstallService.ts
  install、update、remove、enable、disable

SkillLoader.ts
  合并 system runtime Skill 和 user Skill，并处理禁用状态

SkillApplication.ts
  对 CLI 暴露 marketplace/install/update/remove 用例
```

### 安装策略

安装流程：

```txt
1. 从 marketplace index 查找 skill id
2. 校验 source type
3. 读取 source 下文件
4. 校验 SKILL.md manifest
5. 计算 checksum
6. 拷贝到 ~/.mini-agent/skills/user/<id>.tmp
7. 原子替换 ~/.mini-agent/skills/user/<id>
8. 写入 install.json
9. reload SkillRegistry
```

更新流程：

```txt
1. 比较 marketplace version 和 installed version
2. 如果 marketplace 更新，则重复安装流程
3. 保留用户 enabled/disabled 状态
4. reload SkillRegistry
```

卸载流程：

```txt
1. 只允许卸载用户目录中的 Skill
2. system runtime skills 和 bundled ./skills 不允许通过 remove 删除
3. 删除 ~/.mini-agent/skills/user/<id>
4. 清理全局 disabled/enabled 状态
5. reload SkillRegistry
```

### 全局状态

建议新增：

```txt
~/.mini-agent/skills/index.json
```

示例：

```json
{
  "version": 1,
  "disabledSkillIds": ["legacy-skill"],
  "installed": {
    "news-monitor": {
      "version": 1,
      "enabled": true,
      "installedAt": "..."
    }
  }
}
```

### 安全边界

- M5 只安装静态文件，不执行安装脚本。
- 只允许安装到 `~/.mini-agent/skills/user/<id>`。
- `id` 必须通过路径安全校验，不能包含 `../`。
- 安装前必须校验 manifest。
- 安装后必须重新读取并校验实际落盘文件。
- 用户安装 Skill 不能覆盖 system runtime Skill，重复 id 直接报冲突。
- 远程 source 暂不默认启用，未来需要显式确认和 checksum。

### 验收标准

- `/skill-market` 能列出本地 marketplace 中的 Skill。
- `/skill-install <id>` 能安装到用户目录。
- 安装后 `/skills` 能看到该 Skill。
- `/skill-update <id>` 能更新版本。
- `/skill-remove <id>` 只能删除用户安装 Skill。
- 全局禁用后 Skill 不参与自动触发和 Agent 编译。

### 测试重点

- marketplace index 解析。
- 安装路径安全。
- checksum 校验。
- 版本比较。
- 原子安装失败回滚。
- 用户 Skill 与项目 Skill 冲突处理。
- 全局禁用生效。

## 11. 数据结构草案

```ts
export type SkillManifest = {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly description: string;
  readonly triggers?: readonly string[];
  readonly tools?: readonly string[];
  readonly agent?: {
    readonly enabled?: boolean;
    readonly id?: string;
    readonly name?: string;
    readonly maxTurns?: number;
    readonly tools?: readonly string[];
  };
  readonly metadata?: Readonly<Record<string, unknown>>;
};

export type SkillDefinition = {
  readonly manifest: SkillManifest;
  readonly body: string;
  readonly source: SkillSource;
  readonly loadedAt: Date;
};

export type SkillSource = {
  readonly type: "project" | "user" | "marketplace";
  readonly root: string;
  readonly filePath: string;
};

export type SkillSelection = {
  readonly skill: SkillDefinition;
  readonly score: number;
  readonly reason: string;
  readonly manual: boolean;
};
```

## 12. CLI 命令总表

M1：

```txt
/skills
/skill <id>
/skill-doctor
/skill-reload
```

M4：

```txt
/skill-use <id>
/skill-clear
/skill-disable <id>
```

M5：

```txt
/skill-market
/skill-install <id>
/skill-update <id>
/skill-remove <id>
/skill-enable <id>
/skill-disable-global <id>
```

## 13. 与现有模块的关系

### `main.ts`

职责：

- 初始化 `SkillApplication`。
- 将 `SkillApplication` 放入 command context。
- 将 skill runtime 依赖传给 `createAgentOrchestrator`。

### `createAgentOrchestrator.ts`

职责：

- 创建 `SkillRegistry`。
- 加载 skill agents。
- 合并内置 agents 和 skill agents。
- 将 `SkillResolver` 或 `SkillContextProvider` 传给 `AgentGenerator`。

### `AgentGenerator.ts`

职责：

- 每次 run 前根据输入和 thread state 获取 active skills。
- 创建带 skill context 的主 system prompt。
- 发出 `skill_selected` 事件。

### `TaskPlanner.ts`

职责：

- 不需要知道 Skill 细节。
- 只通过 `AgentRegistry.list()` 看到编译后的 skill agents。

### `ToolPolicy.ts`

职责：

- 不允许 Skill 改写默认权限。
- Skill 只能声明自己希望使用哪些工具。

### `JsonStore.ts`

职责：

- M4 保存 thread metadata。
- 兼容旧数据。

## 14. 分阶段实施顺序

建议每个阶段都单独合入，避免一次性改动过大。

```txt
M1.1 定义 Skill 类型和校验
M1.2 实现 SkillLoader 和 SkillRegistry
M1.3 接入 CLI list/get/doctor/reload

M2.1 实现 SkillResolver 确定性匹配
M2.2 实现 SkillPrompt
M2.3 AgentGenerator 注入 skill context
M2.4 增加 skill_selected 事件和 CLI 渲染

M3.1 实现 SkillAgentCompiler
M3.2 createAgentOrchestrator 合并 skill agents
M3.3 限制 planned mode 只使用 read-only skill agents

M4.1 ThreadRecord 增加 metadata
M4.2 SkillApplication 增加 thread skill state 用例
M4.3 CLI 增加 /skill-use /skill-clear /skill-disable

M4.5a 增加 /skill-template 和 /skill-new，支持本地用户 Skill 模板创建
M4.5b 增加 /skill-create [id]，支持模型生成自定义用户 Skill
M4.7a 增加 create_skill 受控工具，支持自然语言对话中创建并安装用户 Skill
M4.7b 安装后热刷新 Skill Agent 注册表，新建 agent.enabled Skill 可进入后续规划
M4.7c 修复 create_skill 收尾超时和失败 checkpoint 污染问题
M4.7d 交互式 CLI 默认禁用全局 run timeout，支持 MINI_AGENT_TIMEOUT_MS 覆盖

M5.1 定义 marketplace index 格式
M5.2 实现 SkillMarketplace
M5.3 实现 SkillInstallService
M5.4 CLI 增加 install/update/remove/enable/disable
M5.5 增加安装安全校验和回滚测试
```

## 15. 风险与取舍

### Prompt 变长

风险：Skill body 过长导致模型上下文浪费。

处理：

- 每个 Skill 注入长度限制。
- 只提取关键章节。
- 默认最多自动注入 2 个 Skill。

### 自动触发误判

风险：用户无关任务误触发 Skill。

处理：

- M2 采用确定性打分。
- 阈值保守。
- CLI 显示启用了哪些 Skill。
- M4 支持当前 thread 禁用某个 Skill。

### Agent 数量膨胀

风险：所有 Skill 都编译成 Agent 后 planner prompt 变长。

处理：

- 只有 `agent.enabled=true` 才编译。
- M3 只让 read-only skill agent 进入 planned mode。
- planner 展示 Agent 时只使用简短 description。

### 安装安全

风险：Skill marketplace 变成任意文件写入或脚本执行入口。

处理：

- M5 只安装静态文件。
- 安装路径强校验。
- 不支持 postinstall。
- checksum 校验。
- 原子安装。

## 16. 推荐优先级

如果只做一条主线，推荐顺序是：

```txt
1. M1：先让 Skill 成为可管理资源
2. M2：让 Skill 真正影响主 Agent 输出
3. M3：让 Skill 进入多 Agent 编排
4. M4：让用户能控制每个会话的 Skill 状态
5. M5：再做安装和市场
```

这样每一步都有明确价值：

- M1 解决“系统认识 Skill”。
- M2 解决“Skill 能影响回答”。
- M3 解决“Skill 能成为专家 Agent”。
- M4 解决“用户能控制 Skill”。
- M5 解决“Skill 能分发和管理”。
