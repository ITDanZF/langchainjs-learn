import { th } from "zod/v4/locales/index.js";

export type ThreadInfo = {
  id?: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
};

export default class Conversation {
  private ThreadMap = new Map<string, ThreadInfo>();

  private ActiveThreadId: string = "default";
  private ActiveConversation: ThreadInfo | null = null;

  constructor() {
    this.ActiveConversation = {
      id: this.ActiveThreadId,
      title: "Default Thread",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ThreadMap.set(this.ActiveThreadId, this.ActiveConversation);
  }

  UUID() {
    return crypto.randomUUID();
  }

  createConversation(Info: ThreadInfo) {
    const id = Info.id || this.UUID();
    this.ThreadMap.set(id, {
      ...Info,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  switchConversation(threadId: string) {
    if (!this.ThreadMap.has(threadId)) {
      throw new Error(`Thread with ID ${threadId} does not exist.`);
    }
    this.ActiveThreadId = threadId;
    this.ActiveConversation = this.ThreadMap.get(threadId) || null;
  }

  public getActiveConversation(): ThreadInfo | null {
    return this.ActiveConversation;
  }

  public getAllConversations(): ThreadInfo[] {
    return Array.from(this.ThreadMap.values());
  }

  public getActiveThreadId(): string {
    return this.ActiveThreadId;
  }
}
