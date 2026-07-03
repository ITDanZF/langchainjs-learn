import Conversation from "../Memory/Conversation.ts";
import Command, { CommandDefinition } from "./Command.ts";
import SessionView from "./SessionView.ts";

export type CommandContext = {
  conversation: Conversation;
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
    handler: (_args, _rawInput, { conversation, sessionView }) => {
      sessionView.renderActiveConversation(conversation);
    },
  },
  {
    name: "threads",
    aliases: ["sessions"],
    usage: "/threads",
    description: "查看所有会话",
    handler: (_args, _rawInput, { conversation, sessionView }) => {
      sessionView.renderConversationList(conversation);
    },
  },
  {
    name: "thread-new",
    aliases: ["session-new"],
    usage: "/thread-new [title]",
    description: "创建新会话并切换过去",
    handler: (args, _rawInput, { conversation, sessionView }) => {
      const title = args.join(" ").trim() || "New Thread";
      const threadId = conversation.createConversation({
        title,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      conversation.switchConversation(threadId);
      sessionView.renderDashboard(conversation);
    },
  },
  {
    name: "thread-use",
    aliases: ["session-use"],
    usage: "/thread-use <id>",
    description: "切换到指定会话",
    handler: (args, _rawInput, { conversation, sessionView }) => {
      const threadId = args[0];

      if (!threadId) {
        sessionView.renderSystemMessage("请提供要切换的会话 ID。");
        return;
      }

      try {
        conversation.switchConversation(threadId);
        sessionView.renderDashboard(conversation);
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
