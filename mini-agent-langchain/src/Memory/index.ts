import { AIMessage, BaseMessage, HumanMessage } from "@langchain/core/messages";
import { MemorySaver } from "@langchain/langgraph";
import SqliteStore from "./SqliteStore.ts";
import JsonStore from "./JsonStore.ts";

export type ThreadId = string;
export type MemoryStore = {
  LocalStore?: "memory" | "sqlite";
};
export default class Memory {
  private readonly LocalCheckPointerObject;
  private readonly JSONStore;

  constructor(params: MemoryStore = {}) {
    if (params?.LocalStore === "sqlite") {
      this.LocalCheckPointerObject = new SqliteStore().getCheckPointer();
    } else {
      this.LocalCheckPointerObject = new MemorySaver();
    }

    this.JSONStore = new JsonStore();
  }
  getCheckoutPointer() {
    return this.LocalCheckPointerObject;
  }
  getJSONStore() {
    return this.JSONStore;
  }

  getConfig(threadId: ThreadId = "default") {
    return {
      configurable: {
        thread_id: threadId,
      },
    };
  }
}
