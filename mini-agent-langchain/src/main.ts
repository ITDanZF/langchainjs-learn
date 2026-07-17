#!/usr/bin/env node
import CLI from "./cli/index.ts";
import Bootstrap from "./bootstrap/index.ts";
import Conversation from "./Memory/Conversation.ts";
import SessionView from "./cli/SessionView.ts";
import commandSet from "./cli/CommandSet.ts";
import AgentGenerator from "./Generator/AgentGenerator.ts";

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
    await runTime.AgentRuntime(commandResult.input);
    // conversation.appendMessage({
    //   role: "user",
    //   content: commandResult.input,
    // });

    // sessionView.renderUserMessage(commandResult.input);
    // sessionView.renderThinking();

    // const result = await runTime.AgentRuntime.model.invoke(
    //   commandResult.input,
    //   conversation.getActiveThreadId(),
    // );
    // conversation.appendMessage({
    //   role: "assistant",
    //   content: JSON.stringify(result.messages?.at(-1)?.content),
    // });

    // sessionView.renderAgentResult(result);
  });
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
