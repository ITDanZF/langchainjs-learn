import ThreadApplication from "../application/ThreadApplication.ts";
import Command, { CommandDefinition } from "./Command.ts";
import SessionView from "./SessionView.ts";

export type CommandContext = {
  threads: ThreadApplication;
  sessionView: SessionView;
};

const commandSet = new Command<CommandContext>([], {
  unknownCommandHandler: (command, _rawInput, { sessionView }) => {
    sessionView.renderSystemMessage(`未知命令：/${command.name}`);
  },
});

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
];

commandSet.registerMany(commands);

export default commandSet;
