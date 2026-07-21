#!/usr/bin/env node
import AgentGenerator from "./Agent/AgentGenerator.ts";
import AgentApplication from "./application/AgentApplication.ts";
import ThreadApplication from "./application/ThreadApplication.ts";
import Bootstrap from "./bootstrap/index.ts";
import CliAdapter from "./cli/CliAdapter.ts";
import InputSession from "./cli/InputSession.ts";
import SessionView from "./cli/SessionView.ts";
import commandSet from "./cli/CommandSet.ts";
import CLI from "./cli/index.ts";
import JsonStore from "./Memory/JsonStore.ts";

async function main() {
  const bootstrap = new Bootstrap();
  await bootstrap.setup();

  const inputSession = new InputSession();
  const cli = new CLI(inputSession);
  const threads = new ThreadApplication(new JsonStore());
  const sessionView = new SessionView();
  const application = new AgentApplication(new AgentGenerator());
  const cliAdapter = new CliAdapter(application, inputSession);

  sessionView.renderDashboard(threads.getSnapshot());

  try {
    await cli.run(process.argv, async (input: string) => {
      const commandResult = await commandSet.execute(input, {
        threads,
        sessionView,
      });

      if (commandResult.type === "stop") {
        return;
      }

      threads.appendMessage({
        role: "user",
        content: commandResult.input,
      });
      sessionView.renderUserMessage(commandResult.input);
      inputSession.write("\x1b[32mAI：\x1b[0m");

      const handleInterrupt = () => {
        if (cliAdapter.cancelActiveRun()) {
          inputSession.write("\n正在取消当前任务；再次按 Ctrl+C 可退出。\n");
        }
      };
      process.once("SIGINT", handleInterrupt);

      let content: string;
      try {
        content = await cliAdapter.runTask(
          threads.getActiveThreadId(),
          commandResult.input,
        );
      } finally {
        process.removeListener("SIGINT", handleInterrupt);
      }

      inputSession.write("\n\n");
      if (content) {
        threads.appendMessage({ role: "assistant", content });
      }
    });
  } finally {
    cliAdapter.dispose();
  }
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
