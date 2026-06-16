import { config } from "./config";
import type { ChatMessage } from "./types";

const input = process.argv.slice(2).join(" ").trim();

/**
 * 添加消息到消息列表
 */
function addMsg(msg: ChatMessage) {
  messages.push(msg);
}

// 缓存历史消息
const messages: ChatMessage[] = [
  {
    role: "system",
    content: "你是一个命令行agent!",
  },
];

if (!input) {
  console.error("请输入要执行的命令");
  process.exit(1);
}

addMsg({
  role: "user",
  content: input,
});

addMsg({
  role: "assistant",
  content: "正在执行命令...",
});

console.log("当前消息列表：", messages);
