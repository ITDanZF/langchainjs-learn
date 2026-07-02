import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";

export type ThreadId = string;

export default class Memory {
  private readonly CheckPointer;
  constructor() {
    this.CheckPointer = new MemorySaver();
  }

  getCheckoutPointer() {
    return this.CheckPointer;
  }

  getConfig(threadId: ThreadId = "default") {
    return {
      configurable: {
        thread_id: threadId,
      },
    };
  }
}
