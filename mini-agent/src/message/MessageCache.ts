import { BaseMessage } from "./type";
import { randomUUID } from "node:crypto";
export default class MessageCache {
  private messages: BaseMessage[] = [];
  constructor() {}

  addUserMsg(content: string) {
    const msg: BaseMessage = {
      id: randomUUID(),
      role: "user",
      content,
      createAt: Date.now(),
    };
    this.messages.push(msg);
    return msg;
  }

  addAIMsg(content: string) {
    const msg: BaseMessage = {
      id: randomUUID(),
      role: "assistant",
      content,
      createAt: Date.now(),
    };
    this.messages.push(msg);
    return msg;
  }

  getMsgCache() {
    return this.messages;
  }
}
