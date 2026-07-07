import path from "node:path";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { getAgentHome } from "../workspace/path.ts";

export type ThreadInfo = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export type StoredMessageRole = "user" | "assistant" | "system" | "tool";

export type StoredMessage = {
  id: string;
  threadId: string;
  role: StoredMessageRole;
  content: string;
  createdAt: Date;
};

type JsonThread = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

type JsonMessage = {
  id: string;
  threadId: string;
  role: StoredMessageRole;
  content: string;
  createdAt: string;
};

type JsonStoreState = {
  threads: JsonThread[];
  messages: JsonMessage[];
};

export default class JsonStore {
  private readonly filePath: string;

  constructor(
    filePath = path.join(getAgentHome(), "sessions", "history.json"),
  ) {
    this.filePath = filePath;
    this.ensureFile();
  }

  ensureDefaultThread(): ThreadInfo {
    const existing = this.getThread("default");

    if (existing) {
      return existing;
    }

    return this.createThread("Default Thread", "default");
  }

  createThread(title: string, id: string = crypto.randomUUID()): ThreadInfo {
    const state = this.readState();
    const now = new Date().toISOString();

    const thread: JsonThread = {
      id,
      title,
      createdAt: now,
      updatedAt: now,
    };

    state.threads.push(thread);
    this.writeState(state);

    return this.toThreadInfo(thread);
  }

  getThread(threadId: string): ThreadInfo | null {
    const state = this.readState();
    const thread = state.threads.find((item) => item.id === threadId);

    return thread ? this.toThreadInfo(thread) : null;
  }

  listThreads(): ThreadInfo[] {
    const state = this.readState();

    return state.threads
      .slice()
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((thread) => this.toThreadInfo(thread));
  }

  updateThreadTitle(threadId: string, title: string) {
    const state = this.readState();
    const thread = state.threads.find((item) => item.id === threadId);

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    thread.title = title;
    thread.updatedAt = new Date().toISOString();

    this.writeState(state);
  }

  touchThread(threadId: string) {
    const state = this.readState();
    const thread = state.threads.find((item) => item.id === threadId);

    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }

    thread.updatedAt = new Date().toISOString();
    this.writeState(state);
  }

  deleteThread(threadId: string) {
    const state = this.readState();

    state.threads = state.threads.filter((item) => item.id !== threadId);
    state.messages = state.messages.filter(
      (item) => item.threadId !== threadId,
    );

    this.writeState(state);
  }

  appendMessage(input: {
    threadId: string;
    role: StoredMessageRole;
    content: string;
    id?: string;
  }): StoredMessage {
    const state = this.readState();

    if (!state.threads.some((thread) => thread.id === input.threadId)) {
      throw new Error(`Thread not found: ${input.threadId}`);
    }

    const now = new Date().toISOString();

    const message: JsonMessage = {
      id: input.id ?? crypto.randomUUID(),
      threadId: input.threadId,
      role: input.role,
      content: input.content,
      createdAt: now,
    };

    state.messages.push(message);

    const thread = state.threads.find((item) => item.id === input.threadId);
    if (thread) {
      thread.updatedAt = now;
    }

    this.writeState(state);

    return this.toStoredMessage(message);
  }

  listMessages(threadId: string): StoredMessage[] {
    const state = this.readState();

    return state.messages
      .filter((message) => message.threadId === threadId)
      .map((message) => this.toStoredMessage(message));
  }

  private ensureFile() {
    mkdirSync(path.dirname(this.filePath), { recursive: true });

    if (!existsSync(this.filePath)) {
      this.writeState({
        threads: [],
        messages: [],
      });
    }
  }

  private readState(): JsonStoreState {
    const content = readFileSync(this.filePath, "utf-8");
    return JSON.parse(content) as JsonStoreState;
  }

  private writeState(state: JsonStoreState) {
    writeFileSync(this.filePath, JSON.stringify(state, null, 2), "utf-8");
  }

  private toThreadInfo(thread: JsonThread): ThreadInfo {
    return {
      id: thread.id,
      title: thread.title,
      createdAt: new Date(thread.createdAt),
      updatedAt: new Date(thread.updatedAt),
    };
  }

  private toStoredMessage(message: JsonMessage): StoredMessage {
    return {
      id: message.id,
      threadId: message.threadId,
      role: message.role,
      content: message.content,
      createdAt: new Date(message.createdAt),
    };
  }
}
