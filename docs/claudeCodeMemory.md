> ## 文档索引
> 在这里获取完整的文档索引：https://code.claude.com/docs/llms.txt
> 在继续浏览之前，使用这个文件发现所有可用页面。

# Claude 如何记住你的项目

> 使用 CLAUDE.md 文件给 Claude 持久化指令，并通过自动记忆让 Claude 自动积累学习内容。

每个 Claude Code 会话都会从一个全新的上下文窗口开始。有两种机制可以在会话之间传递知识：

* **CLAUDE.md 文件**：你编写的指令，用来给 Claude 提供持久上下文
* **自动记忆**：Claude 根据你的纠正和偏好自己写下的笔记

本页介绍如何：

* [编写和组织 CLAUDE.md 文件](#claude-md-files)
* 使用 `.claude/rules/` [将规则限定到特定文件类型](#organize-rules-with-claude/rules/)
* [配置自动记忆](#auto-memory)，让 Claude 自动记笔记
* 当指令没有被遵循时进行[故障排查](#troubleshoot-memory-issues)

## CLAUDE.md 与自动记忆

Claude Code 有两个互补的记忆系统。两者都会在每次对话开始时加载。Claude 会把它们当作上下文，而不是强制执行的配置。如果你想无论 Claude 如何决定都阻止某个操作，请改用 [PreToolUse hook](/en/hooks-guide)。你的指令越具体、越简洁，Claude 就越能稳定地遵循它们。

|                      | CLAUDE.md 文件                                   | 自动记忆                                                       |
| :------------------- | :------------------------------------------------ | :------------------------------------------------------------- |
| **谁来编写**         | 你                                                | Claude                                                         |
| **包含什么**         | 指令和规则                                        | 学习内容和模式                                                 |
| **作用范围**         | 项目、用户或组织                                  | 每个仓库，跨 worktree 共享                                     |
| **加载到哪里**       | 每个会话                                          | 每个会话（前 200 行或 25KB）                                   |
| **用于什么**         | 编码标准、工作流、项目架构                        | 构建命令、调试发现、Claude 发现的偏好                          |

当你想引导 Claude 的行为时，使用 CLAUDE.md 文件。自动记忆让 Claude 从你的纠正中学习，而不需要你手动维护。

子代理也可以维护自己的自动记忆。详情见[子代理配置](/en/sub-agents#enable-persistent-memory)。

## CLAUDE.md 文件

CLAUDE.md 文件是 Markdown 文件，用来给 Claude 提供项目、个人工作流或整个组织的持久化指令。你用纯文本编写这些文件；Claude 会在每次会话开始时读取它们。

### 什么时候添加到 CLAUDE.md

把 CLAUDE.md 当作记录那些你原本需要反复解释内容的地方。在以下情况下添加内容：

* Claude 第二次犯同样的错误
* 代码评审发现了 Claude 本应了解的代码库信息
* 你在聊天里输入了和上个会话相同的纠正或说明
* 新队友也需要同样的上下文才能高效工作

只保留 Claude 在每次会话中都应该掌握的事实：构建命令、约定、项目布局、“始终做 X” 规则。如果某条内容是多步骤流程，或者只对代码库中的某一部分有意义，请改放到[技能](/en/skills)或[路径范围规则](#organize-rules-with-claude/rules/)中。[扩展概览](/en/features-overview#build-your-setup-over-time)说明了什么时候使用每种机制。

### 选择 CLAUDE.md 文件的放置位置

CLAUDE.md 文件可以放在多个位置，每个位置有不同的作用范围。下表按照加载顺序列出，从最宽泛的范围到最具体的范围，因此项目指令会在用户指令之后出现在上下文中。

| 作用范围                 | 位置                                                                                                                                                                  | 目的                                           | 使用示例                                           | 与谁共享                         |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- | -------------------------------- |
| **托管策略**             | macOS：`/Library/Application Support/ClaudeCode/CLAUDE.md`<br />Linux 和 WSL：`/etc/claude-code/CLAUDE.md`<br />Windows：`C:\Program Files\ClaudeCode\CLAUDE.md`      | 由 IT/DevOps 管理的组织级指令                  | 公司编码标准、安全策略、合规要求                   | 组织中的所有用户                 |
| **用户指令**             | `~/.claude/CLAUDE.md`                                                                                                                                                 | 适用于所有项目的个人偏好                       | 代码风格偏好、个人工具快捷方式                     | 只有你（所有项目）               |
| **项目指令**             | `./CLAUDE.md` 或 `./.claude/CLAUDE.md`                                                                                                                               | 团队共享的项目指令                             | 项目架构、编码标准、常用工作流                     | 通过源代码管理与团队成员共享     |
| **本地指令**             | `./CLAUDE.local.md`                                                                                                                                                   | 个人的项目特定偏好；加入 `.gitignore`          | 你的沙盒 URL、偏好的测试数据                       | 只有你（当前项目）               |

工作目录上级目录层级中的 CLAUDE.md 和 CLAUDE.local.md 文件会在启动时完整加载。子目录中的文件会在 Claude 读取这些目录中的文件时按需加载。完整的解析顺序见 [CLAUDE.md 文件如何加载](#how-claude-md-files-load)。

对于大型项目，你可以使用[项目规则](#organize-rules-with-claude/rules/)把指令拆分为按主题组织的文件。规则允许你把指令限定到特定文件类型或子目录。

### 设置项目 CLAUDE.md

项目 CLAUDE.md 可以存储在 `./CLAUDE.md` 或 `./.claude/CLAUDE.md`。创建这个文件，并添加适用于所有项目参与者的指令：构建和测试命令、编码标准、架构决策、命名约定和常用工作流。这些指令会通过版本控制与你的团队共享，因此应关注项目级标准，而不是个人偏好。

<Tip>
  运行 `/init` 可以自动生成一个初始 CLAUDE.md。Claude 会分析你的代码库，并创建一个文件，其中包含它发现的构建命令、测试指令和项目约定。如果 CLAUDE.md 已经存在，`/init` 会建议改进，而不是覆盖它。之后你可以补充 Claude 无法自行发现的指令。

  设置 `CLAUDE_CODE_NEW_INIT=1` 可以启用交互式多阶段流程。`/init` 会询问要设置哪些产物：CLAUDE.md 文件、技能和 hooks。然后它会通过子代理探索你的代码库，通过后续问题补齐缺口，并在写入任何文件之前展示一个可审阅的方案。
</Tip>

### 编写有效指令

CLAUDE.md 文件会在每次会话开始时加载到上下文窗口中，和你的对话一起消耗 token。[上下文窗口可视化](/en/context-window)展示了 CLAUDE.md 相对于其余启动上下文的加载位置。因为它们是上下文，而不是强制执行的配置，所以你的指令写法会影响 Claude 遵循它们的可靠性。具体、简洁、结构清晰的指令效果最好。

**大小**：每个 CLAUDE.md 文件目标控制在 200 行以内。更长的文件会消耗更多上下文，并降低遵循度。如果你的指令越来越大，请使用[路径范围规则](#path-specific-rules)，让指令只在 Claude 处理匹配文件时加载。你也可以把内容拆分为[导入](#import-additional-files)来组织文件，不过被导入的文件仍然会在启动时加载并进入上下文窗口。

**结构**：使用 Markdown 标题和项目符号来分组相关指令。Claude 扫描结构的方式和读者类似：组织良好的分区比密集段落更容易遵循。

**具体性**：编写足够具体、可以验证的指令。例如：

* 使用“使用 2 个空格缩进”，而不是“正确格式化代码”
* 使用“提交前运行 `npm test`”，而不是“测试你的改动”
* 使用“API handlers 位于 `src/api/handlers/`”，而不是“保持文件有组织”

**一致性**：如果两条规则互相矛盾，Claude 可能任意选择其中一条。定期检查你的 CLAUDE.md 文件、子目录中的嵌套 CLAUDE.md 文件，以及 [`.claude/rules/`](#organize-rules-with-claude/rules/)，移除过时或冲突的指令。在 monorepo 中，使用 [`claudeMdExcludes`](#exclude-specific-claude-md-files) 跳过与你的工作无关的其他团队 CLAUDE.md 文件。

### 导入额外文件

CLAUDE.md 文件可以使用 `@path/to/import` 语法导入额外文件。被导入的文件会被展开，并在启动时和引用它们的 CLAUDE.md 一起加载到上下文中。

相对路径和绝对路径都允许。相对路径相对于包含该导入语句的文件解析，而不是相对于工作目录。被导入的文件可以递归导入其他文件，最大深度为四跳。

导入解析会跳过 Markdown 行内代码和围栏代码块。如果你想在 CLAUDE.md 中提到一个路径但不导入它，请把它包在反引号里：写成 `` `@README` `` 会保留字面文本，而反引号之外的 `@README` 会导入该文件。

如果要引入 README、package.json 和工作流指南，可以在 CLAUDE.md 中任意位置使用 `@` 语法引用它们：

```text theme={null}
See @README for project overview and @package.json for available npm commands for this project.

# Additional Instructions
- git workflow @docs/git-instructions.md
```

对于不应该提交到版本控制的项目个人偏好，请在项目根目录创建 `CLAUDE.local.md`。它会和 `CLAUDE.md` 一起加载，并以相同方式处理。把 `CLAUDE.local.md` 加入 `.gitignore`，避免被提交；运行 `/init` 并选择个人选项会自动为你完成这件事。

如果你在同一个仓库的多个 git worktree 中工作，被 gitignore 的 `CLAUDE.local.md` 只会存在于你创建它的那个 worktree 中。要跨 worktree 共享个人指令，可以改为从你的 home 目录导入文件：

```text theme={null}
# Individual Preferences
- @~/.claude/my-project-instructions.md
```

<Warning>
  Claude Code 第一次在项目中遇到外部导入时，会显示一个列出这些文件的审批对话框。如果你拒绝，导入会保持禁用，并且该对话框不会再次出现。
</Warning>

有关更结构化地组织指令的方法，见 [`.claude/rules/`](#organize-rules-with-claude/rules/)。

### AGENTS.md

Claude Code 读取 `CLAUDE.md`，而不是 `AGENTS.md`。如果你的仓库已经为其他 coding agent 使用 `AGENTS.md`，可以创建一个导入它的 `CLAUDE.md`，这样两个工具就能读取同一份指令，而不需要重复内容。你也可以在导入之后添加 Claude 专用指令。Claude 会在会话开始时加载导入的文件，然后追加后面的其余内容：

```markdown CLAUDE.md theme={null}
@AGENTS.md

## Claude Code

Use plan mode for changes under `src/billing/`.
```

如果你不需要添加 Claude 专用内容，也可以使用符号链接：

```bash theme={null}
ln -s AGENTS.md CLAUDE.md
```

在 Windows 上，创建符号链接需要管理员权限或开发者模式，因此请改用 `@AGENTS.md` 导入。

在已经有 `AGENTS.md` 的仓库中运行 [`/init`](/en/commands) 时，它会读取该文件，并把相关部分合并到生成的 `CLAUDE.md` 中。它也会读取其他工具配置，例如 `.cursorrules`、`.devin/rules/` 和 `.windsurfrules`。

### CLAUDE.md 文件如何加载

Claude Code 会从你的当前工作目录开始向上遍历目录树，沿途检查每个目录中的 `CLAUDE.md` 和 `CLAUDE.local.md` 文件。这意味着如果你在 `foo/bar/` 中运行 Claude Code，它会加载来自 `foo/bar/CLAUDE.md`、`foo/CLAUDE.md`，以及与它们并列的任何 `CLAUDE.local.md` 文件中的指令。

所有发现的文件都会被拼接进上下文，而不是互相覆盖。在目录树中，内容按从文件系统根目录到你的工作目录的顺序排列。对于 `foo/bar/` 示例，`foo/CLAUDE.md` 会在上下文中出现在 `foo/bar/CLAUDE.md` 之前，因此离你启动 Claude 的位置更近的指令会被后读取。在每个目录内，`CLAUDE.local.md` 会追加到 `CLAUDE.md` 之后，因此你的个人笔记是 Claude 在该层级最后读取的内容。

Claude 也会发现当前工作目录下子目录中的 `CLAUDE.md` 和 `CLAUDE.local.md` 文件。它们不会在启动时加载，而是在 Claude 读取这些子目录中的文件时被包含进来。

如果你在大型 monorepo 中工作，并且其他团队的 CLAUDE.md 文件被拾取，可以使用 [`claudeMdExcludes`](#exclude-specific-claude-md-files) 跳过它们。关于根级和按目录设置的 CLAUDE.md 文件及规则的完整布局，见 [Monorepos and large repos](/en/large-codebases)。

CLAUDE.md 文件中的块级 HTML 注释（`<!-- maintainer notes -->`）会在内容注入 Claude 上下文之前被移除。你可以用它们给人类维护者留下笔记，而不消耗上下文 token。代码块内的注释会保留。当你直接用 Read 工具打开 CLAUDE.md 文件时，注释仍然可见。

#### 从额外目录加载

`--add-dir` 标志让 Claude 能访问主工作目录之外的额外目录。默认情况下，这些目录中的 CLAUDE.md 文件不会被加载。

如果也想从额外目录加载记忆文件，请设置 `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD` 环境变量：

```bash theme={null}
CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1 claude --add-dir ../shared-config
```

这会从额外目录加载 `CLAUDE.md`、`.claude/CLAUDE.md`、`.claude/rules/*.md` 和 `CLAUDE.local.md`。如果你从 [`--setting-sources`](/en/cli-reference) 中排除了 `local`，则会跳过 `CLAUDE.local.md`。

### 使用 `.claude/rules/` 组织规则

对于较大的项目，你可以使用 `.claude/rules/` 目录把指令组织成多个文件。这让指令保持模块化，也更容易由团队维护。规则还可以[限定到特定文件路径](#path-specific-rules)，因此只会在 Claude 处理匹配文件时加载到上下文中，从而减少噪音并节省上下文空间。

<Note>
  规则会在每个会话中加载到上下文，或在匹配文件被打开时加载。对于不需要一直存在于上下文中的任务特定指令，请改用[技能](/en/skills)。技能只会在你调用它们，或 Claude 判断它们与你的提示相关时加载。
</Note>

#### 设置规则

把 Markdown 文件放到项目的 `.claude/rules/` 目录中。每个文件应该覆盖一个主题，并使用描述性文件名，例如 `testing.md` 或 `api-design.md`。所有 `.md` 文件都会被递归发现，因此你可以把规则组织到 `frontend/` 或 `backend/` 这样的子目录中：

```text theme={null}
your-project/
├── .claude/
│   ├── CLAUDE.md           # 主要项目指令
│   └── rules/
│       ├── code-style.md   # 代码风格指南
│       ├── testing.md      # 测试约定
│       └── security.md     # 安全要求
```

没有 [`paths` frontmatter](#path-specific-rules) 的规则会在启动时加载，优先级与 `.claude/CLAUDE.md` 相同。

#### 路径特定规则

规则可以使用带有 `paths` 字段的 YAML frontmatter 限定到特定文件。这些条件规则只会在 Claude 处理匹配指定模式的文件时适用。

```markdown theme={null}
---
paths:
  - "src/api/**/*.ts"
---

# API Development Rules

- All API endpoints must include input validation
- Use the standard error response format
- Include OpenAPI documentation comments
```

没有 `paths` 字段的规则会无条件加载，并适用于所有文件。路径范围规则会在 Claude 读取匹配该模式的文件时触发，而不是在每次工具使用时触发。

在 `paths` 字段中使用 glob 模式，可以按扩展名、目录或任意组合匹配文件：

| 模式                   | 匹配内容                                 |
| ---------------------- | ---------------------------------------- |
| `**/*.ts`              | 任意目录中的所有 TypeScript 文件         |
| `src/**/*`             | `src/` 目录下的所有文件                  |
| `*.md`                 | 项目根目录中的 Markdown 文件             |
| `src/components/*.tsx` | 特定目录中的 React 组件                  |

你可以指定多个模式，并使用大括号展开在一个模式中匹配多个扩展名：

```markdown theme={null}
---
paths:
  - "src/**/*.{ts,tsx}"
  - "lib/**/*.ts"
  - "tests/**/*.test.ts"
---
```

#### 通过符号链接跨项目共享规则

`.claude/rules/` 目录支持符号链接，因此你可以维护一组共享规则，并把它们链接到多个项目中。符号链接会被正常解析和加载，循环符号链接会被检测并被妥善处理。

下面的示例同时链接了一个共享目录和一个单独文件：

```bash theme={null}
ln -s ~/shared-claude-rules .claude/rules/shared
ln -s ~/company-standards/security.md .claude/rules/security.md
```

#### 用户级规则

`~/.claude/rules/` 中的个人规则适用于你机器上的每个项目。用它们存放非项目特定的偏好：

```text theme={null}
~/.claude/rules/
├── preferences.md    # 你的个人编码偏好
└── workflows.md      # 你偏好的工作流
```

用户级规则会在项目规则之前加载，因此项目规则具有更高优先级。

### 为大型团队管理 CLAUDE.md

对于在团队中部署 Claude Code 的组织，你可以集中管理指令，并控制加载哪些 CLAUDE.md 文件。

#### 部署组织级 CLAUDE.md

组织可以部署一个集中管理的 CLAUDE.md，它适用于一台机器上的所有用户。这个文件不能被个人设置排除。

<Steps>
  <Step title="在托管策略位置创建文件">
    * macOS：`/Library/Application Support/ClaudeCode/CLAUDE.md`
    * Linux 和 WSL：`/etc/claude-code/CLAUDE.md`
    * Windows：`C:\Program Files\ClaudeCode\CLAUDE.md`
  </Step>

  <Step title="使用你的配置管理系统部署">
    使用 MDM、Group Policy、Ansible 或类似工具把文件分发到开发者机器。关于其他组织级配置选项，见[托管设置](/en/permissions#managed-settings)。
  </Step>
</Steps>

`claudeMd` 键允许你把托管 CLAUDE.md 内容直接放入 `managed-settings.json`，而不是部署单独文件。

**作用范围**：机器上的每个 Claude Code 会话，以及每个仓库。对于仓库特定指导，请提交项目 CLAUDE.md。

**优先级**：与托管 CLAUDE.md 文件相同。它会在用户和项目 CLAUDE.md 之前加载。

**在哪里生效**：仅在托管和策略设置中生效。在用户、项目或本地设置中设置 `claudeMd` 没有效果。

下面的示例在托管设置文件中直接添加行为指令：

```json theme={null}
{
  "claudeMd": "Always run `make lint` before committing.\nNever push directly to main."
}
```

托管 CLAUDE.md 和[托管设置](/en/settings#settings-files)有不同用途。技术强制使用 settings，行为指导使用 CLAUDE.md：

| 关注点                                         | 配置位置                                                   |
| :--------------------------------------------- | :--------------------------------------------------------- |
| 阻止特定工具、命令或文件路径                   | 托管设置：`permissions.deny`                               |
| 强制沙盒隔离                                   | 托管设置：`sandbox.enabled`                                |
| 环境变量和 API provider 路由                   | 托管设置：`env`                                            |
| 认证方式和组织锁定                             | 托管设置：`forceLoginMethod`、`forceLoginOrgUUID`          |
| 代码风格和质量指南                             | 托管 CLAUDE.md                                             |
| 数据处理和合规提醒                             | 托管 CLAUDE.md                                             |
| Claude 的行为指令                              | 托管 CLAUDE.md                                             |

Settings 规则会由客户端强制执行，不受 Claude 决定影响。CLAUDE.md 指令会塑造 Claude 的行为，但不是硬性执行层。

#### 排除特定 CLAUDE.md 文件

在大型 monorepo 中，上级目录的 CLAUDE.md 文件可能包含与你的工作无关的指令。`claudeMdExcludes` 设置允许你通过路径或 glob 模式跳过特定文件。

下面的示例从父文件夹中排除了一个顶层 CLAUDE.md 和一个 rules 目录。把它添加到 `.claude/settings.local.json`，使排除只保留在你的机器上：

```json theme={null}
{
  "claudeMdExcludes": [
    "**/monorepo/CLAUDE.md",
    "/home/user/monorepo/other-team/.claude/rules/**"
  ]
}
```

模式会使用 glob 语法匹配绝对文件路径。你可以在任何[设置层级](/en/settings#settings-files)配置 `claudeMdExcludes`：用户、项目、本地或托管策略。数组会跨层级合并。

托管策略 CLAUDE.md 文件不能被排除。这确保组织级指令始终适用，不受个人设置影响。

## 自动记忆

自动记忆让 Claude 在你不写任何内容的情况下跨会话积累知识。Claude 会在工作时为自己保存笔记：构建命令、调试发现、架构笔记、代码风格偏好和工作流习惯。Claude 不会在每个会话都保存内容。它会根据这些信息是否对未来对话有用，决定什么值得记住。

<Note>
  自动记忆需要 Claude Code v2.1.59 或更高版本。使用 `claude --version` 检查你的版本。
</Note>

### 启用或禁用自动记忆

自动记忆默认开启。要切换它，在会话中打开 `/memory` 并使用自动记忆开关，或者在项目设置中设置 `autoMemoryEnabled`：

```json theme={null}
{
  "autoMemoryEnabled": false
}
```

要通过环境变量禁用自动记忆，请设置 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`。

### 存储位置

每个项目都有自己的记忆目录，位于 `~/.claude/projects/<project>/memory/`。`<project>` 路径来自 git 仓库，因此同一个 repo 内的所有 worktree 和子目录共享一个自动记忆目录。在 git repo 之外，会使用项目根目录。

要把自动记忆存储在其他位置，请在 `settings.json` 中设置 `autoMemoryDirectory`。它可以从任何[设置作用范围](/en/settings#settings-precedence)读取：用户、项目、本地、策略或 `--settings`。

```json theme={null}
{
  "autoMemoryDirectory": "~/my-custom-memory-dir"
}
```

该值必须是绝对路径，或以 `~/` 开头。当它设置在项目的 `.claude/settings.json` 或 `.claude/settings.local.json` 中时，只有在你接受该文件夹的 workspace trust 对话框之后才会生效，这和 hooks 使用的门槛相同。

该目录包含一个 `MEMORY.md` 入口文件和可选的主题文件：

```text theme={null}
~/.claude/projects/<project>/memory/
├── MEMORY.md          # 简洁索引，加载到每个会话
├── debugging.md       # 调试模式的详细笔记
├── api-conventions.md # API 设计决策
└── ...                # Claude 创建的其他主题文件
```

`MEMORY.md` 充当记忆目录的索引。Claude 会在你的会话期间读写这个目录中的文件，并使用 `MEMORY.md` 跟踪哪些内容存在哪里。

自动记忆是机器本地的。同一个 git 仓库内的所有 worktree 和子目录共享一个自动记忆目录。文件不会跨机器或云环境共享。

### 工作原理

每次对话开始时，会加载 `MEMORY.md` 的前 200 行，或前 25KB，以先达到者为准。超过该阈值的内容不会在会话开始时加载。Claude 会通过把详细笔记移动到单独的主题文件中，保持 `MEMORY.md` 简洁。

这个限制只适用于 `MEMORY.md`。无论长度如何，CLAUDE.md 文件都会完整加载，不过较短文件会带来更好的遵循度。

像 `debugging.md` 或 `patterns.md` 这样的主题文件不会在启动时加载。Claude 会在需要这些信息时，使用它的标准文件工具按需读取它们。

Claude 会在你的会话期间读写记忆文件。当你在 Claude Code 界面中看到 “Writing memory” 或 “Recalled memory” 时，Claude 正在主动更新或读取 `~/.claude/projects/<project>/memory/`。

### 审计和编辑你的记忆

自动记忆文件是普通 Markdown，你可以随时编辑或删除。运行 [`/memory`](#view-and-edit-with-%2Fmemory)，可以在会话内浏览并打开记忆文件。

## 使用 `/memory` 查看和编辑

`/memory` 命令会列出当前会话加载的所有 CLAUDE.md、CLAUDE.local.md 和 rules 文件，允许你开启或关闭自动记忆，并提供打开自动记忆文件夹的链接。选择任何文件都可以在编辑器中打开。

当你要求 Claude 记住某件事，例如“始终使用 pnpm，而不是 npm”或“记住 API 测试需要本地 Redis 实例”时，Claude 会把它保存到自动记忆中。如果你想把指令添加到 CLAUDE.md，请直接要求 Claude，例如“把这个添加到 CLAUDE.md”，或者通过 `/memory` 自己编辑该文件。

## 记忆问题故障排查

以下是 CLAUDE.md 和自动记忆最常见的问题，以及调试步骤。

### Claude 没有遵循我的 CLAUDE.md

CLAUDE.md 内容会在系统提示之后作为用户消息传递，而不是作为系统提示本身的一部分。Claude 会读取并尝试遵循它，但不保证严格遵守，尤其是在指令含糊或互相冲突时。

调试方法：

* 运行 `/memory`，确认你的 CLAUDE.md 和 CLAUDE.local.md 文件正在被加载。如果文件没有列出，Claude 就看不到它。
* 检查相关 CLAUDE.md 是否位于会被当前会话加载的位置（见[选择 CLAUDE.md 文件的放置位置](#choose-where-to-put-claude-md-files)）。
* 让指令更具体。“使用 2 个空格缩进”比“漂亮地格式化代码”更有效。
* 查找 CLAUDE.md 文件之间的冲突指令。如果两个文件对同一行为给出不同指导，Claude 可能任意选择其中一条。

如果指令必须在特定时间点执行，例如每次提交前或每次文件编辑后，请把它写成 [hook](/en/hooks-guide)。Hooks 会在固定生命周期事件中作为 shell 命令执行，并且不受 Claude 决定影响。

对于你想放在系统提示级别的指令，请使用 [`--append-system-prompt`](/en/cli-reference#system-prompt-flags)。它必须在每次调用时传入，因此相比交互式使用，更适合脚本和自动化。

<Tip>
  使用 [`InstructionsLoaded` hook](/en/hooks#instructionsloaded) 可以准确记录哪些指令文件被加载、何时加载以及为什么加载。这对于调试路径特定规则或子目录中的懒加载文件很有用。
</Tip>

### 我不知道自动记忆保存了什么

运行 `/memory`，选择自动记忆文件夹，浏览 Claude 保存的内容。所有内容都是普通 Markdown，你可以阅读、编辑或删除。

### 我的 CLAUDE.md 太大

超过 200 行的文件会消耗更多上下文，并可能降低遵循度。使用[路径范围规则](#path-specific-rules)，让指令只在 Claude 处理匹配文件时加载，或者删减不是每个会话都需要的内容。拆分成 [`@path` 导入](#import-additional-files)有助于组织内容，但不会减少上下文，因为被导入的文件会在启动时加载。

### `/compact` 后指令似乎丢失

项目根目录的 CLAUDE.md 会在压缩后保留：执行 `/compact` 后，Claude 会从磁盘重新读取它，并重新注入到会话中。子目录中的嵌套 CLAUDE.md 文件不会自动重新注入；它们会在 Claude 下一次读取该子目录中的文件时重新加载。

如果某条指令在压缩后消失，要么它只是在对话中给出的，要么它位于尚未重新加载的嵌套 CLAUDE.md 中。把只在对话中给出的指令添加到 CLAUDE.md，可以让它们持久化。完整说明见[压缩后保留什么](/en/context-window#what-survives-compaction)。

关于大小、结构和具体性的指导，见[编写有效指令](#write-effective-instructions)。

## 相关资源

* [调试你的配置](/en/debug-your-config)：诊断为什么 CLAUDE.md 或 settings 没有生效
* [技能](/en/skills)：打包按需加载的可重复工作流
* [设置](/en/settings)：使用设置文件配置 Claude Code 行为
* [子代理记忆](/en/sub-agents#enable-persistent-memory)：让子代理维护自己的自动记忆
