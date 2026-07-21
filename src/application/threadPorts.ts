export type ThreadRecord = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type MessageRole = "user" | "assistant" | "system" | "tool";

export type MessageRecord = {
  readonly id: string;
  readonly threadId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: Date;
};

export interface ThreadStore {
  ensureInitialThread(): ThreadRecord;
  createThread(title: string, id?: string): ThreadRecord;
  getThread(threadId: string): ThreadRecord | null;
  listThreads(): ThreadRecord[];
  touchThread(threadId: string): void;
  deleteThread(threadId: string): void;
}

export interface MessageStore {
  appendMessage(input: {
    threadId: string;
    role: MessageRole;
    content: string;
    id?: string;
  }): MessageRecord;
  listMessages(threadId: string): MessageRecord[];
}

export type ThreadPersistence = ThreadStore & MessageStore;
