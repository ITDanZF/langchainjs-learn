# Skill 系统运行测试报告（M0-M4）

测试时间：2026-07-22 00:37-00:45（Asia/Shanghai）

## 1. 测试目标

本次测试目标是把程序实际运行起来，并按阶段验证 Skill 系统从 M0 到 M4 的核心能力：

- M0：默认 bundled Skill 同步到运行时目录。
- M1：Skill 加载、校验、注册、查看和 reload。
- M2：Skill 自动解析、会话状态参与解析、Skill prompt 注入。
- M3：Skill Agent 编译，以及 planned mode 只允许只读 Skill Agent。
- M4：会话级 Skill 启用、禁用、清空和持久化。

## 2. 测试环境

为避免污染真实用户目录，本次运行使用隔离目录：

```txt
MINI_AGENT_HOME=/tmp/mini-agent-skill-runtime-home-manual
MINI_AGENT_BUNDLED_SKILLS=<repo>/skills
```

由于本次测试重点是 Skill 系统 M0-M4 的本地运行时能力，CLI 启动时使用 dummy 模型配置跳过首次配置向导。测试没有向模型发送真实对话请求，也没有测试需要外部网络的模型推理链路。

## 3. CLI 真实运行测试

### 3.1 构建程序

执行：

```bash
npm run build
```

结果：通过，`tsc` 构建成功。

### 3.2 启动程序

执行：

```bash
MINI_AGENT_HOME=/tmp/mini-agent-skill-runtime-home-manual \
MINI_AGENT_BUNDLED_SKILLS="$PWD/skills" \
node dist/main.js
```

结果：通过，CLI 成功启动并显示 Dashboard、会话列表和 Skill 相关命令。

### 3.3 Skill 列表

执行：

```txt
/skills
```

结果：通过，显示系统 Skill：

```txt
create-skill v1 system agent managed
```

验证点：M0 同步后的 `create-skill` 已被 M1 加载并注册。

### 3.4 Skill 详情

执行：

```txt
/skill create-skill
```

结果：通过，显示：

- 来源：`system`
- 托管：是
- 子 Agent：启用
- 路径：`/tmp/mini-agent-skill-runtime-home-manual/skills/system/create-skill/SKILL.md`
- 工具：`read_file, list_files, search_text, write_file, edit_file`

验证点：manifest、正文、tools、agent 配置均可被读取和渲染。

### 3.5 Skill Doctor

执行：

```txt
/skill-doctor
```

结果：通过：

```txt
状态：通过
Skill 数量：1
问题数量：0
```

验证点：M1 加载校验无错误。

### 3.6 Skill 模板与用户 Skill 创建

执行：

```txt
/skill-template runtime-skill
/skill-new runtime-skill
/skills
```

结果：通过：

- `/skill-template runtime-skill` 打印合法模板。
- `/skill-new runtime-skill` 创建用户 Skill：`/tmp/mini-agent-skill-runtime-home-manual/skills/user/runtime-skill/SKILL.md`
- 再次 `/skills` 显示两个 Skill：

```txt
create-skill v1 system agent managed
runtime-skill v1 user prompt custom
```

验证点：用户 Skill 可以创建、写入、reload 后参与注册。

### 3.7 会话级 Skill 状态

执行：

```txt
/skill-use create-skill
/skill-disable runtime-skill
/skill-clear
```

结果：通过：

- `/skill-use create-skill` 后固定启用为 `create-skill`。
- `/skill-disable runtime-skill` 后禁用自动触发为 `runtime-skill`。
- `/skill-clear` 后固定启用和禁用自动触发都恢复为 `none`。

验证点：M4 CLI 命令可以更新当前会话 Skill 状态。

### 3.8 Skill Reload

重启同一隔离 home 后执行：

```txt
/skill-reload
```

结果：通过，重新加载后仍显示：

```txt
create-skill
runtime-skill
```

验证点：M1 reload 能重新同步系统 Skill，并保留用户 Skill 加载结果。

## 4. 文件系统验证

运行后检查隔离目录，关键文件存在：

```txt
/tmp/mini-agent-skill-runtime-home-manual/config.json
/tmp/mini-agent-skill-runtime-home-manual/sessions/index.json
/tmp/mini-agent-skill-runtime-home-manual/sessions/<thread-id>.json
/tmp/mini-agent-skill-runtime-home-manual/sessions/memory.sqlite
/tmp/mini-agent-skill-runtime-home-manual/skills/index.json
/tmp/mini-agent-skill-runtime-home-manual/skills/system/create-skill/SKILL.md
/tmp/mini-agent-skill-runtime-home-manual/skills/system/create-skill/install.json
/tmp/mini-agent-skill-runtime-home-manual/skills/user/runtime-skill/SKILL.md
```

`skills/index.json` 中包含：

```json
{
  "version": 1,
  "systemSkillIds": ["create-skill"],
  "disabledSkillIds": [],
  "installed": {
    "create-skill": {
      "kind": "system",
      "version": 1,
      "enabled": true,
      "managed": true
    }
  }
}
```

会话索引中包含 Skill metadata：

```json
{
  "metadata": {
    "activeSkillIds": [],
    "disabledSkillIds": []
  }
}
```

验证点：M0 的系统 Skill 同步、M1 的索引、M4 的会话 metadata 都已落盘。

## 5. M0-M4 动态断言测试

除了 CLI 手工命令，还执行了一个临时动态断言脚本，直接调用运行时模块验证 M0-M4 关键链路。

执行：

```bash
npx tsx /tmp/mini-agent-m0-m4-runtime-check.ts
```

结果：全部通过：

```txt
M0: PASS - bundled create-skill synced into isolated system skill root
M1: PASS - loader/application registered system and user skills with doctor clean
M2: PASS - resolver selected create-skill and context provider injected manual thread skill prompt
M3: PASS - skill agents compiled and planned mode accepts read-only skill agents only
M4: PASS - thread-level active/disabled skill state updates and persists
```

### 5.1 M0 验证点

- `SkillBootstrap.syncBundledSkills()` 成功执行。
- `skills/create-skill/SKILL.md` 被同步到隔离的 `skills/system/create-skill/SKILL.md`。
- `skills/index.json` 记录 `create-skill`。
- 无 bootstrap warnings。

### 5.2 M1 验证点

- `SkillLoader` 同时加载 system Skill 和 user Skill。
- `SkillApplication.reload()` 返回两个 Skill。
- `create-skill` 来源为 `system`。
- 动态创建的 `readonly-agent` 来源为 `user`。
- snapshot issues 为 0。

### 5.3 M2 验证点

- `SkillResolver` 对输入“请帮我创建一个新的 skill”命中 `create-skill`。
- `SkillContextProviderService` 读取 thread skill state。
- 手动启用 `readonly-agent` 后，即使输入不强匹配，也能注入该 Skill prompt。
- prompt 中包含 `Active skills for this run` 和 `readonly-agent`。

### 5.4 M3 验证点

- `compileSkillAgents()` 将启用 `agent.enabled=true` 的 Skill 编译为 Agent。
- `create-skill` 被编译为 Skill Agent，但因为 `metadata.readOnly=false`，`planningEligible=false`。
- 动态创建的 `readonly-agent` 因为 `metadata.readOnly=true`，`planningEligible=true`。
- `PlanValidator` 接受使用 `readonly-agent` 的 planned task。
- `PlanValidator` 拒绝使用 `create-skill` 的 planned task。

### 5.5 M4 验证点

- `ThreadApplication.useSkill()` 写入 active skill。
- `ThreadApplication.disableSkill()` 写入 disabled skill。
- `ThreadApplication.clearSkillState()` 清空状态。
- `JsonStore` 将 thread metadata 持久化到 `sessions/index.json`。

## 6. 全量测试

执行：

```bash
npm run test
```

结果：通过：

```txt
Test Files  13 passed (13)
Tests       32 passed (32)
```

说明：本次报告的 M0-M4 阶段覆盖主要依赖真实 CLI 运行和临时动态断言脚本；`npm run test` 作为现有测试套件回归验证。

## 7. 未覆盖范围

以下内容本次未覆盖：

- 真实模型 API 调用下的自然语言对话端到端 Skill 触发，因为当前测试环境没有使用真实 API key，且网络不是本次 M0-M4 本地能力测试目标。
- M4.5 的 `/skill-create` 模型生成流程，因为用户指定本次范围为 M0 到 M4。
- M5 marketplace / install / update / remove，因为当前决定暂缓实现 M5。

## 8. 结论

M0 到 M4 的 Skill 系统核心链路验证通过：

```txt
bundled skills -> runtime sync -> load/register -> resolve/inject -> compile skill agents -> thread skill state
```

当前系统已经具备本地 Skill 创建、加载、查看、会话控制、prompt 注入和只读 Skill Agent 参与 planned mode 的基础能力。下一步如果暂缓 M5，建议进入稳定化阶段：补齐持久测试文件、README 使用说明、CLI 端到端脚本，以及真实模型环境下的少量 smoke test。
