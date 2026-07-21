import type { MessageRole } from "./threadPorts.ts";

export type ThreadDto = {
  readonly id: string;
  readonly title: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type MessageDto = {
  readonly id: string;
  readonly threadId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly createdAt: string;
};

export type ThreadSnapshot = {
  readonly activeThreadId: string;
  readonly activeThread: ThreadDto;
  readonly threads: readonly ThreadDto[];
};

export type CreateThreadRequest = {
  readonly title: string;
  readonly id?: string;
};

export type AppendMessageRequest = {
  readonly role: MessageRole;
  readonly content: string;
  readonly threadId?: string;
};
