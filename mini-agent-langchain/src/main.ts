#!/usr/bin/env node
import CLI from "./cli/index.ts";
import Bootstrap from "./bootstrap/index.ts";
import Conversation from "./Memory/Conversation.ts";
import SessionView from "./cli/SessionView.ts";
import commandSet from "./cli/CommandSet.ts";

async function main() {
  const cli = new CLI();
  const bootstrap = new Bootstrap();

  const runTime = await bootstrap.setup();
  const conversation = new Conversation();
  const sessionView = new SessionView();

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
    sessionView.renderThinking();

    const result = await runTime.AgentRuntime.model.invoke(
      commandResult.input,
      conversation.getActiveThreadId(),
    );
    conversation.appendMessage({
      role: "assistant",
      content: JSON.stringify(result.messages?.at(-1)?.content),
    });

    sessionView.renderAgentResult(result);
  });
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
