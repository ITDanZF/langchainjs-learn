#!/usr/bin/env node
import { ask, streamAsk } from "./model/AskChain.js";
import { PrintStream } from "./utils/Print.js";
import { createAgentWorkSpace, createHomeRoot } from "./workspace/path.js";
import CLI from "./cli/index.js";
import Bootstrap from "./bootstrap/index.ts";

async function main() {
  const cli = new CLI();
  const bootstrap = new Bootstrap();

  await bootstrap.setup();

  // await cli.run(process.argv, async (input: string) => {
  //   const stream = await streamAsk(input);
  //   await PrintStream(stream);
  // });
}

main().catch((error) => {
  console.error("程序启动失败：", error);
  process.exitCode = 1;
});
