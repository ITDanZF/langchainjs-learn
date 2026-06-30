#!/usr/bin/env node
import { PrintStream } from "./utils/Print.ts";
import CLI from "./cli/index.ts";
import Bootstrap from "./bootstrap/index.ts";

async function main() {
  const cli = new CLI();
  const bootstrap = new Bootstrap();

  const runTime = await bootstrap.setup();

  await cli.run(process.argv, async (input: string) => {
    const result = await runTime.AgentRuntime.model.stream(input);
    await PrintStream(result);
  });
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
