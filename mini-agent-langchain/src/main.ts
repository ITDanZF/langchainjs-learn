import { Command } from "commander";
import { joinArgs, ensureInput } from "./utils/input.ts";
async function main() {
  const program = new Command();

  program
    .name("mini-agent")
    .description("A mini Agent CLI built step by step with LangChain.js")
    .version("0.1.0");

  program
    .command("ask")
    .description("请求一个问题：")
    .argument("<input...>", "question text")
    .action(async (input: string[]) => {
      const question = joinArgs(input);
      if (!ensureInput(question, "请输入问题")) return;

      console.log(`收到问题：${question}`);
    });

  await program.parseAsync(process.argv);
}

main();
