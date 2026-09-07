import ThreadApplication from "../application/ThreadApplication.ts";
import SkillApplication from "../skills/SkillApplication.ts";
import Command, { CommandDefinition } from "./Command.ts";
import InputSession from "./InputSession.ts";
import SessionView from "./SessionView.ts";

export type CommandContext = {
  threads: ThreadApplication;
  skills: SkillApplication;
  sessionView: SessionView;
  inputSession: InputSession;
};

const commandSet = new Command<CommandContext>([], {
  unknownCommandHandler: (command, _rawInput, { sessionView }) => {
    sessionView.renderSystemMessage(`未知命令：/${command.name}`);
  },
});

function splitList(value: string): readonly string[] {
  return Object.freeze(
    value
      .split(/[,，、\n]/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseYes(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "y" || normalized === "yes" || normalized === "是";
}

function parseNo(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return normalized === "n" || normalized === "no" || normalized === "否";
}

const commands: CommandDefinition<CommandContext>[] = [
  {
    name: "thread",
    aliases: ["session"],
    usage: "/thread",
    description: "查看当前会话",
    handler: (_args, _rawInput, { threads, sessionView }) => {
      sessionView.renderActiveConversation(threads.getSnapshot());
    },
  },
  {
    name: "threads",
    aliases: ["sessions"],
    usage: "/threads",
    description: "查看所有会话",
    handler: (_args, _rawInput, { threads, sessionView }) => {
      sessionView.renderConversationList(threads.getSnapshot());
    },
  },
  {
    name: "thread-new",
    aliases: ["session-new"],
    usage: "/thread-new [title]",
    description: "创建新会话并切换过去",
    handler: (args, _rawInput, { threads, sessionView }) => {
      const title = args.join(" ").trim() || "New Thread";
      threads.createThread({ title });
      sessionView.renderDashboard(threads.getSnapshot());
    },
  },
  {
    name: "thread-use",
    aliases: ["session-use"],
    usage: "/thread-use <id>",
    description: "切换到指定会话",
    handler: (args, _rawInput, { threads, sessionView }) => {
      const threadId = args[0];

      if (!threadId) {
        sessionView.renderSystemMessage("请提供要切换的会话 ID。");
        return;
      }

      try {
        threads.switchThread(threadId);
        sessionView.renderDashboard(threads.getSnapshot());
      } catch (error) {
        sessionView.renderError(error);
      }
    },
  },
  {
    name: "help",
    aliases: ["h"],
    usage: "/help",
    description: "显示命令帮助",
    handler: (_args, _rawInput, { sessionView }) => {
      sessionView.renderHelp();
    },
  },
  {
    name: "skills",
    usage: "/skills",
    description: "查看已加载 Skill",
    handler: (_args, _rawInput, { skills, sessionView }) => {
      sessionView.renderSkillList(skills.getSnapshot());
    },
  },
  {
    name: "skill",
    usage: "/skill <id>",
    description: "查看 Skill 详情",
    handler: (args, _rawInput, { skills, sessionView }) => {
      const skillId = args[0];
      if (!skillId) {
        sessionView.renderSystemMessage("请提供 Skill ID。");
        return;
      }

      try {
        const skill = skills.getSkill(skillId);
        if (!skill) {
          sessionView.renderSystemMessage(`未找到 Skill：${skillId}`);
          return;
        }
        sessionView.renderSkillDetail(skill);
      } catch (error) {
        sessionView.renderError(error);
      }
    },
  },
  {
    name: "skill-doctor",
    usage: "/skill-doctor",
    description: "检查 Skill 加载状态",
    handler: (_args, _rawInput, { skills, sessionView }) => {
      sessionView.renderSkillDoctor(skills.doctor());
    },
  },
  {
    name: "skill-reload",
    usage: "/skill-reload",
    description: "重新同步并加载 Skill",
    handler: async (_args, _rawInput, { skills, sessionView }) => {
      try {
        const snapshot = await skills.reload();
        sessionView.renderSystemMessage("Skill 已重新加载。");
        sessionView.renderSkillList(snapshot);
      } catch (error) {
        sessionView.renderError(error);
      }
    },
  },
  {
    name: "skill-use",
    usage: "/skill-use <id>",
    description: "当前会话固定启用 Skill",
    handler: (args, _rawInput, { threads, skills, sessionView }) => {
      const skillId = args[0];
      if (!skillId) {
        sessionView.renderSystemMessage("请提供 Skill ID。");
        return;
      }
      if (!skills.getSkill(skillId)) {
        sessionView.renderSystemMessage(`未找到 Skill：${skillId}`);
        return;
      }

      sessionView.renderThreadSkillState(threads.useSkill(skillId));
    },
  },
  {
    name: "skill-disable",
    usage: "/skill-disable <id>",
    description: "当前会话禁用自动命中的 Skill",
    handler: (args, _rawInput, { threads, skills, sessionView }) => {
      const skillId = args[0];
      if (!skillId) {
        sessionView.renderSystemMessage("请提供 Skill ID。");
        return;
      }
      if (!skills.getSkill(skillId)) {
        sessionView.renderSystemMessage(`未找到 Skill：${skillId}`);
        return;
      }

      sessionView.renderThreadSkillState(threads.disableSkill(skillId));
    },
  },
  {
    name: "skill-clear",
    usage: "/skill-clear",
    description: "清除当前会话 Skill 设置",
    handler: (_args, _rawInput, { threads, sessionView }) => {
      sessionView.renderThreadSkillState(threads.clearSkillState());
    },
  },
  {
    name: "skill-template",
    usage: "/skill-template [id]",
    description: "打印标准 SKILL.md 模板",
    handler: (args, _rawInput, { skills, sessionView }) => {
      try {
        sessionView.renderSkillTemplate(skills.renderTemplate(args[0]));
      } catch (error) {
        sessionView.renderError(error);
      }
    },
  },
  {
    name: "skill-new",
    usage: "/skill-new <id>",
    description: "创建用户 Skill 模板",
    handler: async (args, _rawInput, { skills, sessionView }) => {
      const skillId = args[0];
      if (!skillId) {
        sessionView.renderSystemMessage("请提供 Skill ID。");
        return;
      }

      try {
        const created = await skills.createUserSkillTemplate({ id: skillId });
        sessionView.renderSystemMessage(`已创建 Skill：${created.filePath}`);
        const skill = skills.getSkill(created.id);
        if (skill) {
          sessionView.renderSkillDetail(skill);
        }
      } catch (error) {
        sessionView.renderError(error);
      }
    },
  },
  {
    name: "skill-create",
    usage: "/skill-create [id]",
    description: "通过模型生成并创建用户 Skill",
    handler: async (args, _rawInput, { skills, sessionView, inputSession }) => {
      const skillId = (args[0] ?? await inputSession.ask("Skill ID：")).trim();
      if (!skillId) {
        sessionView.renderSystemMessage("请提供 Skill ID。");
        return;
      }

      try {
        if (skills.getSkill(skillId)) {
          sessionView.renderSystemMessage(`Skill 已存在：${skillId}`);
          return;
        }

        const name = (await inputSession.ask("名称：")).trim();
        const description = (await inputSession.ask("描述：")).trim();
        const triggers = splitList(await inputSession.ask("触发词（逗号分隔）："));
        const requestedTools = splitList(await inputSession.ask("工具（逗号分隔，默认 read_file）："));
        const agentEnabled = parseYes(await inputSession.ask("启用 Skill 子 Agent？[y/N]："));
        const readOnlyInput = await inputSession.ask("只读 Skill？[Y/n]：");
        const readOnly = readOnlyInput.trim() === "" || !parseNo(readOnlyInput);
        const extraInstructions = await inputSession.ask("补充要求（可空）：");

        if (!name || !description) {
          sessionView.renderSystemMessage("名称和描述不能为空。");
          return;
        }

        const confirm = parseYes(await inputSession.ask("生成并写入用户 Skill？[y/N]："));
        if (!confirm) {
          sessionView.renderSystemMessage("已取消 Skill 创建。");
          return;
        }

        sessionView.renderSystemMessage("正在生成 Skill 草案...");
        const created = await skills.createUserSkillFromDraft({
          id: skillId,
          name,
          description,
          triggers,
          tools: requestedTools.length > 0 ? requestedTools : ["read_file"],
          agentEnabled,
          readOnly,
          extraInstructions,
        });

        sessionView.renderSystemMessage(`已创建 Skill：${created.filePath}`);
        const skill = skills.getSkill(created.id);
        if (skill) {
          sessionView.renderSkillDetail(skill);
        }
      } catch (error) {
        sessionView.renderError(error);
      }
    },
  },
];

commandSet.registerMany(commands);

export default commandSet;
