import { MemorySaver } from "@langchain/langgraph";
import SqliteStore from "./SqliteStore.ts";
import JsonStore from "./JsonStore.ts";

export type ThreadId = string;
export type MemoryStore = {
  checkpointBackend?: "memory" | "sqlite";
  LocalStore?: "memory" | "sqlite";
};
export default class Memory {
  private readonly checkpointer;
  private readonly jsonStore;

  constructor(params: MemoryStore = {}) {
    const checkpointBackend = params.checkpointBackend ?? params.LocalStore ?? "memory";

    if (checkpointBackend === "sqlite") {
      this.checkpointer = new SqliteStore().getCheckpointer();
    } else {
      this.checkpointer = new MemorySaver();
    }

    this.jsonStore = new JsonStore();
  }

  getCheckpointer() {
    return this.checkpointer;
  }

  getCheckoutPointer() {
    return this.getCheckpointer();
  }

  getJSONStore() {
    return this.jsonStore;
  }

  getConfig(threadId: ThreadId = "default") {
    return {
      configurable: {
        thread_id: threadId,
      },
    };
  }
}
