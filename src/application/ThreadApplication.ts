import type {
  AppendMessageRequest,
  CreateThreadRequest,
  MessageDto,
  ThreadDto,
  ThreadSnapshot,
} from "./threadContracts.ts";
import type {
  MessageRecord,
  ThreadPersistence,
  ThreadRecord,
} from "./threadPorts.ts";

function toThreadDto(thread: ThreadRecord): ThreadDto {
  return Object.freeze({
    id: thread.id,
    title: thread.title,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
  });
}

function toMessageDto(message: MessageRecord): MessageDto {
  return Object.freeze({
    id: message.id,
    threadId: message.threadId,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  });
}

export default class ThreadApplication {
  private activeThreadId: string;

  constructor(private readonly store: ThreadPersistence) {
    this.activeThreadId = store.ensureInitialThread().id;
  }

  getActiveThreadId(): string {
    return this.activeThreadId;
  }

  getSnapshot(): ThreadSnapshot {
    const activeThread = this.requireThread(this.activeThreadId);
    return Object.freeze({
      activeThreadId: this.activeThreadId,
      activeThread: toThreadDto(activeThread),
      threads: Object.freeze(this.store.listThreads().map(toThreadDto)),
    });
  }

  createThread(request: CreateThreadRequest): ThreadDto {
    const title = request.title.trim();
    if (!title) {
      throw new Error("Thread title is required.");
    }

    const thread = this.store.createThread(title, request.id);
    this.activeThreadId = thread.id;
    return toThreadDto(thread);
  }

  switchThread(threadId: string): ThreadSnapshot {
    const normalizedId = threadId.trim();
    this.requireThread(normalizedId);
    this.activeThreadId = normalizedId;
    return this.getSnapshot();
  }

  appendMessage(request: AppendMessageRequest): MessageDto {
    const threadId = request.threadId?.trim() ?? this.activeThreadId;
    this.requireThread(threadId);
    return toMessageDto(
      this.store.appendMessage({
        threadId,
        role: request.role,
        content: request.content,
      }),
    );
  }

  listMessages(threadId = this.activeThreadId): readonly MessageDto[] {
    this.requireThread(threadId);
    return Object.freeze(this.store.listMessages(threadId).map(toMessageDto));
  }

  deleteThread(threadId: string): ThreadSnapshot {
    const normalizedId = threadId.trim();
    this.requireThread(normalizedId);
    this.store.deleteThread(normalizedId);

    if (normalizedId === this.activeThreadId) {
      this.activeThreadId = this.store.ensureInitialThread().id;
    }
    return this.getSnapshot();
  }

  private requireThread(threadId: string): ThreadRecord {
    if (!threadId) {
      throw new Error("Thread id is required.");
    }

    const thread = this.store.getThread(threadId);
    if (!thread) {
      throw new Error(`Thread not found: ${threadId}`);
    }
    return thread;
  }
}
