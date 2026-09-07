# Create Skill 引导系统设计

本文档设计 Skill 系统开发前的 **M0 阶段**：先内置一个 `create-skill` 默认 Skill，用它来指导用户和 Agent 创建、校验、改进新的 `SKILL.md`。

M0 的目标是让 Skill 系统具备自举能力：系统还没有完整 marketplace 之前，已经能从项目根目录的 `skills/` 读取 bundled default skills，并在启动时同步到用户数据目录中的运行时 Skill 目录。其中最基础的默认 Skill 就是“如何创建 Skill”。

## 1. 为什么需要 M0

后续 M1-M5 会实现 Skill 加载、触发、注入、编译、安装和市场。但在正式开发前，先定义 `create-skill` 有几个好处：

- 统一 `SKILL.md` 的写法，避免每个 Skill 格式不一致。
- 给用户一个可复制的默认模板。
- 给 Agent 一个创建 Skill 的标准流程。
- 让 Skill 系统可以通过根目录 `skills/` 和用户数据目录之间的同步机制自举默认内容。
- 为 M1 的 Loader/Doctor 提供真实样例和验收对象。

`create-skill` 本质上不是“代码生成工具”，而是一个内置说明型 Skill：它告诉 Agent 如何询问需求、如何生成 manifest、如何组织 Markdown、如何自检。

## 2. M0 目标

M0 完成后，系统应该具备：

```txt
1. 本地 Skill 根目录初始化
2. 根目录 `skills/` 作为 bundled default skills 源
3. create-skill/SKILL.md 默认文件
4. 启动后将 bundled skills 同步到运行时 system skills
5. 默认 Skill 的 manifest 规范
6. 默认 Skill 的加载优先级和保护规则
7. 后续 /skill-new 或 /skill-create 命令的设计基础
```

M0 不要求实现完整自动生成命令，也不要求调用模型写文件。M0 先把文件系统、默认内容和边界定义清楚。

## 3. 默认 Skill 的定位

默认 Skill 分三类：

```txt
bundled default skill
  项目根目录 ./skills 中的默认 Skill 源
  开发期随仓库维护，发布期随 CLI/npm 包或桌面应用资源发布
  例如 ./skills/create-skill/SKILL.md

system runtime skill
  启动后从 bundled default skills 同步到用户数据目录
  由系统管理，运行时从这里读取
  例如 ~/.mini-agent/skills/system/create-skill/SKILL.md

project skill
  当前项目下的 ./skills
  适合项目团队共享

user skill
  用户目录 ~/.mini-agent/skills
  适合用户个人安装和修改
```

`create-skill` 推荐先放在项目根目录 `./skills/create-skill/SKILL.md`，作为 bundled default skill。项目启动后再同步到 `~/.mini-agent/skills/system/create-skill/SKILL.md`，作为运行时 system skill。

这样可以同时满足 CLI 和未来桌面应用：

```txt
开发期
  ./skills 是默认 Skill 源

发布期 CLI/npm 包
  ./skills 随包发布，是只读默认资源

未来桌面应用
  ./skills 会变成 app bundle/resources 中的只读资源

运行时
  ~/.mini-agent/skills/system 是稳定可读的用户数据目录副本
```

## 4. 本地文件系统设计

推荐运行时目录：

```txt
~/.mini-agent/
  skills/
    index.json
    system/
      create-skill/
        SKILL.md
        README.md
        install.json
    user/
      <skill-id>/
        SKILL.md
        README.md
        assets/
    cache/
      marketplace/
```

项目目录继续保留：

```txt
./skills/
  create-skill/
    SKILL.md
  <bundled-skill-id>/
    SKILL.md
```

目录职责：

```txt
./skills
  bundled default skills 源目录
  由项目维护，不作为用户运行时编辑目录

~/.mini-agent/skills/system
  从 ./skills 同步出来的 system runtime skills
  由系统管理，普通 remove 不删除

~/.mini-agent/skills/user
  用户创建或安装的 skills
  M5 marketplace 默认安装到这里
```

运行时加载来源顺序建议：

```txt
1. ~/.mini-agent/skills/system
2. ~/.mini-agent/skills/user
3. 当前工作区显式配置的 project skills（可选扩展）
```

说明：M0-M5 不建议运行时直接把根目录 `./skills` 当作常规加载来源。`./skills` 的职责是 bundled source，启动时通过同步机制进入 `system` 后再加载。这样未来桌面应用可以把 bundled source 放进只读 app resources，而运行时仍然只依赖用户数据目录。

冲突策略建议：

```txt
同 id 冲突时直接报错
  不做静默覆盖
  避免用户以为启用的是 A，实际加载的是 B

system runtime skill 不允许被 user skill 覆盖
  如果用户想改 create-skill，应复制成 create-skill-custom
```

原因：早期系统应该可解释，避免多来源合并带来的隐式行为。

## 5. 默认 Skill 初始化流程

启动时 `Bootstrap` 在创建 `~/.mini-agent` 后执行默认 Skill 初始化和 bundled skills 同步。

流程：

```txt
Bootstrap.setup()
  -> WorkSpace.createHomeRoot()
  -> WorkSpace.createAgentWorkSpace()
  -> SkillBootstrap.ensureSkillRoots()
  -> SkillBootstrap.syncBundledSkills()
  -> SkillLoader.loadAll()
```

`ensureSkillRoots()` 创建：

```txt
~/.mini-agent/skills
~/.mini-agent/skills/system
~/.mini-agent/skills/user
~/.mini-agent/skills/cache
~/.mini-agent/skills/cache/marketplace
```

`syncBundledSkills()` 行为：

```txt
扫描 ./skills/<skill-id>/SKILL.md
  解析 manifest
  校验 id、version、description、body
  计算 bundled checksum

如果 ~/.mini-agent/skills/system/<skill-id>/SKILL.md 不存在
  从 ./skills/<skill-id> 复制到 system runtime 目录
  写入 install.json

如果已存在
  校验 install.json 中的 managed=true
  比较 installed checksum、previous bundled checksum、current bundled checksum
  如果用户未修改且 bundled version 更高，则安全更新
  如果用户已修改，则不覆盖，写出 warning 或 <skill-id>.new
```

默认更新策略：

```txt
bundled default skill 是源文件
system runtime skill 由系统管理
用户不应该直接修改
如果检测到用户修改，可选择：
  1. 保留用户文件并给 warning
  2. 写入 .new 文件
  3. 提示用户执行 /skill-system-update
```

M0 推荐先用保守策略：

```txt
如果 system runtime skill 已存在，不静默覆盖
如果 bundled version 更高但 system runtime 文件被改过，写入 .new 或提示 doctor
如果校验失败，提示运行 doctor
```

## 6. 桌面应用兼容性

这个同步模型天然适合未来桌面应用。

桌面应用中目录会变成：

```txt
App resources
  bundled skills，只读

User data directory
  system runtime skills、user skills、index、cache
```

不同平台的用户数据目录可以映射为：

```txt
macOS
  ~/Library/Application Support/mini-agent/

Windows
  %APPDATA%/mini-agent/

Linux
  ~/.config/mini-agent/

当前 CLI 阶段
  ~/.mini-agent/
```

因此代码中需要抽象路径函数：

```txt
getAgentHome()
getBundledSkillRoot()
getSkillHome()
getSystemSkillRoot()
getUserSkillRoot()
getSkillCacheRoot()
```

不要在业务逻辑中直接硬编码 `~/.mini-agent/skills/system` 或 `./skills`。

## 7. create-skill 的 manifest 设计

默认 `create-skill/SKILL.md`：

```md
---
id: create-skill
name: 创建 Skill
version: 1
description: 帮助用户设计、创建、校验和改进 mini-agent-langchain 的 SKILL.md 文件。
triggers:
  - 创建 skill
  - 新建 skill
  - 编写 SKILL.md
  - 设计技能
  - skill 模板
tools:
  - read_file
  - list_files
  - search_text
  - write_file
  - edit_file
agent:
  enabled: true
  id: create-skill
  name: Create Skill
  maxTurns: 6
  tools:
    - read_file
    - list_files
    - search_text
    - write_file
    - edit_file
metadata:
  category: system
  readOnly: false
  builtIn: true
  managed: true
---
```

说明：

- `readOnly: false`，因为它最终可能创建文件。
- 即使声明了 `write_file` 和 `edit_file`，仍然必须走工具审批。
- M3 之前它只是 prompt skill；M3 后可以编译为子 Agent。
- planned mode 当前只支持 `sideEffect: none`，所以 `create-skill` 暂时不进入自动 planned mode。

## 8. create-skill 的正文结构

正文推荐包含这些章节：

```txt
# 创建 Skill

## 使用场景
说明什么时候应该启用 create-skill。

## 创建前需要确认的信息
列出应该向用户确认的问题。

## SKILL.md 标准结构
给出 frontmatter 和正文模板。

## 编写规则
说明命名、触发词、工具声明、agent 声明、metadata 的规则。

## 生成流程
从需求澄清到写入文件的步骤。

## 自检清单
生成后检查 id、description、triggers、tools、正文、输出格式。

## 输出约定
如果只是设计，输出草案；如果用户要求落盘，创建文件并说明路径。
```

## 9. create-skill 默认正文草案

可以作为内置文件的第一版内容：

````md
# 创建 Skill

你是 mini-agent-langchain 的 Skill 创建助手。你的任务是帮助用户把一个可复用能力整理成标准 `SKILL.md`。

## 使用场景

当用户要求创建、设计、重写、迁移、检查或改进 Skill 时，使用本 Skill。

典型表达包括：

- 创建一个 skill
- 帮我写一个 SKILL.md
- 把这套流程沉淀成 skill
- 设计一个用于某任务的技能
- 检查这个 skill 是否规范

## 创建前需要确认的信息

如果用户没有提供足够信息，先确认：

1. Skill 要解决什么任务？
2. 什么时候应该触发这个 Skill？
3. 是否需要读文件、写文件、搜索文本或调用其他工具？
4. 是否需要作为子 Agent 被委派？
5. 输出应该是什么格式？
6. 有哪些必须遵守的限制？

如果信息已经足够，不要反复追问，直接生成草案。

## SKILL.md 标准结构

Skill 文件必须包含 frontmatter 和 Markdown 正文。

frontmatter 示例：

```yaml
---
id: example-skill
name: 示例 Skill
version: 1
description: 简短说明这个 Skill 解决什么问题。
triggers:
  - 示例任务
tools:
  - read_file
agent:
  enabled: false
metadata:
  category: general
  readOnly: true
---
```

正文建议包含：

- 使用场景
- 输入要求
- 标准工作流程
- 输出格式
- 质量检查清单
- 限制与注意事项

## 编写规则

- `id` 使用小写字母、数字、短横线或下划线。
- `name` 使用用户可读名称。
- `description` 写清楚能力边界和适用场景。
- `triggers` 使用用户真实可能输入的关键词。
- `tools` 只声明必要工具。
- 如果 Skill 可能修改文件，`metadata.readOnly` 必须是 `false`。
- 如果 `agent.enabled=true`，必须提供适合作为子 Agent 的清晰职责。
- 不要在 Skill 中要求绕过审批、安全策略或工作区边界。

## 生成流程

1. 理解用户想沉淀的任务。
2. 提炼稳定触发场景。
3. 判断是否需要工具。
4. 判断是否需要编译为子 Agent。
5. 生成 frontmatter。
6. 生成正文工作流和输出格式。
7. 执行自检。
8. 如果用户要求落盘，写入 `skills/<id>/SKILL.md`。

## 自检清单

生成后检查：

- `id` 是否稳定且唯一。
- `description` 是否具体。
- `triggers` 是否覆盖真实说法。
- `tools` 是否最小化。
- 正文是否包含工作流程。
- 正文是否包含输出格式。
- 是否明确安全限制。
- 如果启用 agent，是否定义了清晰职责和工具范围。

## 输出约定

如果用户只是要求设计，输出 `SKILL.md` 草案。

如果用户要求创建文件，先说明目标路径，然后创建：

```txt
skills/<id>/SKILL.md
```

创建后返回：

- 文件路径
- Skill id
- 主要触发词
- 使用到的工具
- 是否启用 agent
````

注意：上面正文中嵌套了 Markdown 代码块，实际写入文件时需要正确闭合代码块。

## 10. 默认 Skill 元数据文件

`install.json` 建议：

```json
{
  "id": "create-skill",
  "version": 1,
  "kind": "system",
  "managed": true,
  "installedAt": "2026-07-21T00:00:00.000Z",
  "source": {
    "type": "bundled",
    "root": "./skills/create-skill",
    "name": "mini-agent-langchain"
  },
  "bundledChecksum": "sha256:...",
  "installedChecksum": "sha256:...",
  "enabled": true
}
```

`~/.mini-agent/skills/index.json` 建议：

```json
{
  "version": 1,
  "systemSkillIds": ["create-skill"],
  "disabledSkillIds": [],
  "installed": {
    "create-skill": {
      "version": 1,
      "kind": "system",
      "enabled": true,
      "managed": true
    }
  }
}
```

## 11. 和后续 M1-M5 的关系

### M1：只读 Skill Loader

M1 需要能加载 M0 创建的：

```txt
~/.mini-agent/skills/system/create-skill/SKILL.md
```

M1 不直接依赖根目录 `./skills` 作为运行时加载来源。根目录 `./skills` 由 M0 的同步流程处理。

M1 的 `/skills` 应显示：

```txt
create-skill  创建 Skill  system  enabled
```

M1 的 `/skill-doctor` 应检查：

- 默认 system skill 是否存在。
- manifest 是否有效。
- install.json 是否有效。
- 默认目录是否完整。

### M2：自动触发与 Prompt 注入

当用户输入：

```txt
帮我创建一个用于代码审查的 skill
```

`SkillResolver` 应命中 `create-skill`，并注入它的流程。

### M3：Skill 编译为子 Agent

`create-skill` 可以编译为子 Agent，但默认不进入自动 planned mode，因为它是 `readOnly: false`。

只有用户明确要求创建 Skill 文件时，主 Agent 或 create-skill Agent 才可以调用写入工具，并且仍然需要审批。

### M4：会话级 Skill 状态

用户可以在一个会话中固定启用：

```txt
/skill-use create-skill
```

适合连续设计多个 Skill 的场景。

### M5：Skill 安装/市场

`create-skill` 是 system skill，不通过 marketplace 卸载。

M5 可以允许更新 system skill，但必须走专门命令：

```txt
/skill-system-update create-skill
```

不建议普通 `/skill-remove` 删除 system skill。

## 12. 命令设计

M0 只设计，不一定马上实现。

推荐后续增加：

```txt
/skill-new <id>
  使用 create-skill 创建一个空模板

/skill-create [id]
  进入交互式 Skill 创建流程

/skill-template
  打印标准 SKILL.md 模板
```

命令行为：

```txt
/skill-new code-review
  -> 默认创建 ~/.mini-agent/skills/user/code-review/SKILL.md
  -> 使用最小模板
  -> 不调用模型

/skill-create generated-skill
  -> 询问名称、场景、工具、是否 agent
  -> 调用 Agent 生成完整 SKILL.md
  -> 写入前请求确认
  -> 默认写入 ~/.mini-agent/skills/user/generated-skill/SKILL.md
```

说明：根目录 `./skills` 主要用于项目维护 bundled default skills，不建议作为普通用户创建 Skill 的默认写入目录。CLI 阶段如果需要创建项目级默认 Skill，可以后续增加显式参数，例如 `/skill-new code-review --project`。

M0 推荐优先实现 `/skill-template`，因为它最简单、风险最低。

## 13. 最小模板

`/skill-template` 可以输出：

```md
---
id: example-skill
name: 示例 Skill
version: 1
description: 简短说明这个 Skill 解决什么问题、适用于什么场景。
triggers:
  - 示例触发词
tools:
  - read_file
agent:
  enabled: false
metadata:
  category: general
  readOnly: true
---

# 示例 Skill

## 使用场景

说明用户在什么情况下应该使用这个 Skill。

## 输入要求

说明需要用户提供哪些信息。

## 标准工作流程

1. 第一步。
2. 第二步。
3. 第三步。

## 输出格式

说明最终回答应该如何组织。

## 质量检查清单

- 是否满足用户目标。
- 是否遵守工具和安全限制。
- 是否给出清晰可执行的结果。
```

## 14. 实现模块建议

M0 可以新增这些模块，或者先在 M1 中合并实现：

```txt
src/skills/DefaultSkills.ts
  可选。保存内置 fallback 内容，优先使用 ./skills 中的文件

src/skills/SkillBootstrap.ts
  创建目录并同步 ./skills 到 system runtime skills

src/skills/SkillPaths.ts
  统一计算 bundled/system/user/cache 路径
```

`SkillBootstrap` API 草案：

```ts
export type SkillBootstrapResult = {
  readonly createdDirectories: readonly string[];
  readonly createdSkills: readonly string[];
  readonly warnings: readonly string[];
};

export default class SkillBootstrap {
  async ensureSkillRoots(): Promise<SkillBootstrapResult>;
  async syncBundledSkills(): Promise<SkillBootstrapResult>;
}
```

## 15. 验收标准

M0 完成标准：

- 根目录存在 `skills/create-skill/SKILL.md`。
- 启动时能把 `skills/create-skill/SKILL.md` 同步到 `~/.mini-agent/skills/system/create-skill/SKILL.md`。
- 启动时能创建 `~/.mini-agent/skills/index.json`。
- 已存在 system runtime Skill 时不静默覆盖用户修改。
- `create-skill` manifest 符合后续 M1 schema。
- `create-skill` 正文包含创建流程、自检清单和模板。
- 后续 M1 Loader 可以直接读取该文件。
- 同步逻辑不依赖当前工作目录，未来可替换为桌面应用 resources 目录。

## 16. 推荐先后顺序

```txt
1. 先写 skills/create-skill/SKILL.md 默认内容
2. 再写 SkillPaths 和 SkillBootstrap
3. 接入 Bootstrap.setup()
4. 增加最小测试，验证目录和文件创建
5. 再进入 M1 Loader/Registry/CLI
```

这样做的好处是：M1 开发时已经有真实默认 Skill，不需要再用临时 fixture 模拟系统行为。

## 15. M4.7a：自然语言自动落盘 Skill

M4.7a 引入受控工具 `create_skill`，用于支持用户在自然语言对话中要求创建 Skill 时自动落盘。

关键原则：

- `create-skill` 不再通过 `write_file` 或 `edit_file` 创建 `SKILL.md`。
- `create_skill` 不接收任意路径，只接收 `id` 和完整 `content`。
- 宿主应用固定写入 `~/.mini-agent/skills/user/<id>/SKILL.md`。
- 写入前仍走工具审批，审批预览展示目标路径和完整 proposed `SKILL.md`。
- 写入后调用 `SkillApplication.reload()`，因此 `/skills` 可以立即看到新 Skill。

推荐自然语言流程：

```txt
用户：帮我创建一个甜美小姐姐模式的 skill
create-skill：生成完整 SKILL.md
create-skill：调用 create_skill({ id, content })
CLI：展示审批预览
用户：允许
系统：写入 ~/.mini-agent/skills/user/<id>/SKILL.md 并 reload
```

### M4.7b：安装后热刷新 Skill Agent

M4.7b 解决 `create_skill` 成功安装后，运行时 `AgentRegistry` 仍然只包含启动时 Skill Agent 的问题。

实现原则：

- `SkillInstallService` 在安装完成后发布 after-install 事件。
- `createAgentOrchestrator` 订阅安装事件。
- 事件触发后，基于 `skillDefinitionsProvider()` 重新编译 Skill Agents。
- `AgentRegistry` 只替换 `metadata.source === "skill"` 的 Agent，保留内置 Agent。
- 新创建的 prompt Skill 在 reload 后立即参与 resolver；新创建的 `agent.enabled=true` 且 `readOnly=true` Skill Agent 可进入后续 planned mode。

限制：

- 正在运行中的计划不会被中途重写。
- 热刷新影响安装完成后的后续 run。
- 非只读 Skill Agent 仍不会进入 planned mode。

### M4.7c：超时与工具调用恢复

自然语言创建 Skill 时可能出现两类超时问题：

1. `create_skill` 已安装成功，但模型继续输出长总结，导致 run 超时。
2. run 在工具调用中途超时，LangGraph checkpoint 中留下 assistant `tool_calls` 但缺少对应 tool result，下一次对话会触发 `INVALID_TOOL_RESULTS`。

修复策略：

- `create_skill` 设置 `returnDirect: true`，安装成功后直接把工具结果返回给用户，不再让模型继续生成长篇总结。
- `SkillManifest` parser 支持常见 YAML 写法：`tools: []`、`triggers: []`、简单 inline array、`description: >`、`description: |`。
- `create-skill` 文档仍建议使用简单 YAML 子集，减少模型生成失败后的多轮重试。
- `AgentApplication` 在 run failed / timed out / aborted 后 best-effort 清理当前 thread 及其子 run 的 SQLite checkpoints，避免坏 tool-call 历史污染下一次对话。

这保证了即使创建 Skill 的 run 超时，后续普通对话也不会因为半截 tool call checkpoint 继续失败。

### M4.7d：交互式 CLI 默认禁用全局 Run Timeout

CLI 场景中，用户需要阅读工具审批预览、检查 proposed `SKILL.md`，这些人工等待时间不应该触发 120 秒全局超时。

M4.7d 将全局 run timeout 改为默认禁用：

```txt
DEFAULT_RUN_LIMITS.timeoutMs = 0
```

语义：

- `timeoutMs = 0` 表示不启用全局自动超时。
- 用户仍可通过 Ctrl+C 取消当前 run。
- 如需在自动化或非交互环境中启用超时，可设置环境变量：

```bash
MINI_AGENT_TIMEOUT_MS=600000 npm run dev
```

`MINI_AGENT_TIMEOUT_MS` 必须是非负整数；未设置或非法值时按 `0` 处理。
