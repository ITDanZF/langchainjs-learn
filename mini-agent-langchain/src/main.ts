#!/usr/bin/env node
import { PrintStream } from "./utils/Print.ts";
import CLI from "./cli/index.ts";
import Bootstrap from "./bootstrap/index.ts";
import Conversation from "./Memory/Conversation.ts";

async function main() {
  const cli = new CLI();
  const bootstrap = new Bootstrap();

  const runTime = await bootstrap.setup();
  const conversation = new Conversation();

  await cli.run(process.argv, async (input: string) => {
    const result = await runTime.AgentRuntime.model.invoke(
      input,
      conversation.getActiveThreadId(),
    );
    console.log(result.messages.at(-1)?.content);
  });
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
