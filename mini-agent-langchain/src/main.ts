import { Command } from "commander";
import { joinArgs, ensureInput } from "./utils/input.ts";
import { ask } from "./model/AskChain.ts";
async function main() {
  const program = new Command();

  program.name("mini-agent");
  program.description("A mini Agent CLI built step by step with LangChain.js");
  program.version("0.1.0");

  const askCommand = program.command("ask");

  askCommand.description("请求一个问题：");
  askCommand.argument("<input...>", "question text");
  askCommand.action(async (input: string[]) => {
    const question = joinArgs(input);
    if (!ensureInput(question, "请输入问题")) return;

    const response = await ask(question);
    console.log(`收到问题：${question}`);
    console.log(`回复：`, response.content);
  });
  await program.parseAsync(process.argv);
}

main();
