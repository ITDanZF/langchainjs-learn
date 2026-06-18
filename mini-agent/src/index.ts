import { config } from "./config";
import type { ChatMessage } from "./types";
import { DeepSeek } from "./service/index";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

//  创建第一个readline接口实例
const rl = readline.createInterface({ input, output });
async function main() {
  // 缓存历史消息
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: "你是一个命令行agent!",
    },
  ];

  /**
   * 添加消息到消息列表
   */
  function addMsg(msg: ChatMessage) {
    messages.push(msg);
  }

  let running = true;
  while (running) {
    const userInput = await rl.question("请输入命令（输入exit或quit退出）：");

    if (userInput == null) {
      console.log("EOF, 退出");
      running = false;
      continue;
    }

    const input = userInput.trim();

    if (input === "exit" || input === "quit") {
      console.log("再见！");
      running = false;
      continue;
    }

    if (input === "") continue;

    // 1.添加用户输入的消息 到历史缓存
    const HumanMessage: ChatMessage = {
      role: "user",
      content: input,
    };
    addMsg(HumanMessage);

    // 2.调用ai模型
    const aiMsg = await DeepSeek(messages, (chunk) => {
      // 流式输出
      process.stdout.write(chunk);
    });
    process.stdout.write("\n");
    const AiMessage: ChatMessage = {
      role: "assistant",
      content: aiMsg,
    };
    addMsg(AiMessage);

    // 截取命令
    const [command, ...args] = input.split(/\s+/);
  }

  rl.close();
}

main();
