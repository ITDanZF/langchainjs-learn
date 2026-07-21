import { describe, expect, it } from "vitest";

import ThreadApplication from "../../src/application/ThreadApplication.js";
import type {
  MessageRecord,
  MessageRole,
  ThreadPersistence,
  ThreadRecord,
} from "../../src/application/threadPorts.js";

class MemoryThreadStore implements ThreadPersistence {
  private readonly threads = new Map<string, ThreadRecord>();
  private readonly messages = new Map<string, MessageRecord[]>();
  private sequence = 0;

  ensureInitialThread(): ThreadRecord {
    return this.listThreads()[0] ?? this.createThread("Default Thread", "default");
  }

  createThread(title: string, id = `thread-${++this.sequence}`): ThreadRecord {
    if (this.threads.has(id)) {
      throw new Error(`Thread already exists: ${id}`);
    }
    const timestamp = new Date(this.sequence * 1000);
    const thread = { id, title, createdAt: timestamp, updatedAt: timestamp };
    this.threads.set(id, thread);
    this.messages.set(id, []);
    return thread;
  }

  getThread(threadId: string): ThreadRecord | null {
    return this.threads.get(threadId) ?? null;
  }

  listThreads(): ThreadRecord[] {
    return [...this.threads.values()];
  }

  touchThread(): void {}

  deleteThread(threadId: string): void {
    this.threads.delete(threadId);
    this.messages.delete(threadId);
  }

  appendMessage(input: {
    threadId: string;
    role: MessageRole;
    content: string;
    id?: string;
  }): MessageRecord {
    const message = {
      id: input.id ?? `message-${++this.sequence}`,
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      createdAt: new Date(this.sequence * 1000),
    };
    this.messages.get(input.threadId)?.push(message);
    return message;
  }

  listMessages(threadId: string): MessageRecord[] {
    return [...(this.messages.get(threadId) ?? [])];
  }
}

describe("ThreadApplication", () => {
  it("returns JSON-safe snapshots and switches the active thread", () => {
    const application = new ThreadApplication(new MemoryThreadStore());
    const created = application.createThread({ title: "  Work  " });
    const snapshot = application.getSnapshot();

    expect(created.title).toBe("Work");
    expect(snapshot.activeThreadId).toBe(created.id);
    expect(snapshot.activeThread.title).toBe("Work");
    expect(() => JSON.stringify(snapshot)).not.toThrow();

    application.switchThread("default");
    expect(application.getSnapshot().activeThreadId).toBe("default");
  });

  it("coordinates messages through the persistence port", () => {
    const application = new ThreadApplication(new MemoryThreadStore());
    const thread = application.createThread({ title: "Messages" });

    const message = application.appendMessage({
      role: "user",
      content: "hello",
    });

    expect(message.threadId).toBe(thread.id);
    expect(application.listMessages()).toEqual([message]);
    expect(typeof message.createdAt).toBe("string");
  });

  it("selects a valid fallback after deleting the active thread", () => {
    const application = new ThreadApplication(new MemoryThreadStore());
    const thread = application.createThread({ title: "Temporary" });

    const snapshot = application.deleteThread(thread.id);

    expect(snapshot.activeThreadId).toBe("default");
    expect(snapshot.threads.some((item) => item.id === thread.id)).toBe(false);
  });
});
