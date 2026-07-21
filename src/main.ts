#!/usr/bin/env node
import CLI from "./cli/index.ts";
import Bootstrap from "./bootstrap/index.ts";
import Conversation from "./Memory/Conversation.ts";
import SessionView from "./cli/SessionView.ts";
import commandSet from "./cli/CommandSet.ts";
import AgentGenerator from "./Agent/AgentGenerator.ts";

async function main() {
  const cli = new CLI();
  const bootstrap = new Bootstrap();

  await bootstrap.setup();
  const conversation = new Conversation();
  const sessionView = new SessionView();
  const runTime = new AgentGenerator();

  sessionView.renderDashboard(conversation);

  await cli.run(process.argv, async (input: string) => {
    const commandResult = await commandSet.execute(input, {
      conversation,
      sessionView,
    });

    if (commandResult.type === "stop") {
      return;
    }

    // 运行一次标识单次的任务执行
    conversation.appendMessage({
      role: "user",
      content: commandResult.input,
    });

    sessionView.renderUserMessage(commandResult.input);
    process.stdout.write("\x1b[32mAI：\x1b[0m");

    const content = await runTime.run(commandResult.input, {
      threadId: conversation.getActiveThreadId(),
      onChunk: (chunk) => {
        process.stdout.write(chunk);
      },
      onAgentEvent: (event) => {
        if (event.agentType === 'main') {
          return;
        }

        switch (event.type) {
          case 'run_started':
            process.stdout.write(
              `\n[agent:test] started ${event.agentType} (${event.runId})\n`,
            );
            break;

          case 'run_completed':
            process.stdout.write(
              `\n[agent:test] completed ${event.agentType} (${event.runId})\n`,
            );
            break;

          case 'run_aborted':
            process.stdout.write(
              `\n[agent:test] aborted ${event.agentType} (${event.runId})\n`,
            );
            break;

          case 'run_failed':
            process.stdout.write(
              `\n[agent:test] failed ${event.agentType}: ${event.error}\n`,
            );
            break;

          case 'text_delta':
            break;
        }
      },
    });

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
