#!/usr/bin/env node
import CLI from "./cli/index.ts";
import Bootstrap from "./bootstrap/index.ts";
import Conversation from "./Memory/Conversation.ts";
import SessionView from "./cli/SessionView.ts";
import commandSet from "./cli/CommandSet.ts";
import AgentGenerator from "./Agent/AgentGenerator.ts";
import { promptForToolApproval } from "./cli/ToolApprovalPrompt.ts";

async function main() {
  const cli = new CLI();
  const bootstrap = new Bootstrap();

  await bootstrap.setup();
  const conversation = new Conversation();
  const sessionView = new SessionView();
  const runTime = new AgentGenerator({ approval: promptForToolApproval });

  sessionView.renderDashboard(conversation);

  await cli.run(process.argv, async (input: string) => {
    const commandResult = await commandSet.execute(input, {
      conversation,
      sessionView,
    });

    if (commandResult.type === "stop") {
      return;
    }

    conversation.appendMessage({
      role: "user",
      content: commandResult.input,
    });

    sessionView.renderUserMessage(commandResult.input);
    process.stdout.write("\x1b[32mAI：\x1b[0m");

    const handleInterrupt = () => {
      if (runTime.cancelCurrentRun()) {
        process.stdout.write("\n正在取消当前任务；再次按 Ctrl+C 可退出。\n");
      }
    };
    process.once("SIGINT", handleInterrupt);

    let content: string;
    try {
      content = await runTime.run(commandResult.input, {
        threadId: conversation.getActiveThreadId(),
        onChunk: (chunk) => {
          process.stdout.write(chunk);
        },
        onAgentEvent: (event) => {
          if (event.agentType === "main") {
            return;
          }

          switch (event.type) {
            case "run_started":
              process.stdout.write(
                `\n[agent] started ${event.agentType} (${event.runId})\n`,
              );
              break;
            case "run_completed":
              process.stdout.write(
                `\n[agent] completed ${event.agentType} (${event.runId})\n`,
              );
              break;
            case "run_aborted":
              process.stdout.write(
                `\n[agent] aborted ${event.agentType} (${event.runId})\n`,
              );
              break;
            case "run_timed_out":
              process.stdout.write(
                `\n[agent] timed out ${event.agentType} (${event.runId})\n`,
              );
              break;
            case "run_failed":
              process.stdout.write(
                `\n[agent] failed ${event.agentType}: ${event.error}\n`,
              );
              break;
            case "tool_failed":
              process.stdout.write(
                `\n[tool] failed ${event.toolName}: ${event.error}\n`,
              );
              break;
            case "text_delta":
            case "tool_started":
            case "tool_approval_requested":
            case "tool_approved":
            case "tool_rejected":
            case "tool_completed":
              break;
          }
        },
      });
    } finally {
      process.removeListener("SIGINT", handleInterrupt);
    }

    process.stdout.write("\n\n");

    if (content) {
      conversation.appendMessage({
        role: "assistant",
        content,
      });
    }
  });
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
