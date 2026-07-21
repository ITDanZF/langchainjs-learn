import AgentApplication from "../application/AgentApplication.ts";
import type { ApplicationEvent } from "../application/contracts.ts";
import CliEventRenderer from "./CliEventRenderer.ts";
import InputSession from "./InputSession.ts";

export default class CliAdapter {
  private activeRunId: string | null = null;
  private approvalQueue: Promise<void> = Promise.resolve();
  private readonly unsubscribe: () => void;

  constructor(
    private readonly application: AgentApplication,
    private readonly input: InputSession,
    private readonly renderer = new CliEventRenderer(input),
  ) {
    this.unsubscribe = application.subscribe((event) =>
      this.handleEvent(event),
    );
  }

  async runTask(threadId: string, input: string): Promise<string> {
    const runId = this.application.startRun({ threadId, input });
    this.activeRunId = runId;

    try {
      return await this.application.waitForRun(runId);
    } finally {
      if (this.activeRunId === runId) {
        this.activeRunId = null;
      }
    }
  }

  cancelActiveRun(): boolean {
    return this.activeRunId
      ? this.application.cancelRun(this.activeRunId)
      : false;
  }

  dispose(): void {
    this.unsubscribe();
  }

  private async handleEvent(event: ApplicationEvent): Promise<void> {
    if (event.type === "approval_requested") {
      this.approvalQueue = this.approvalQueue.then(async () => {
        let decision: "allow_once" | "allow_session" | "deny" = "deny";
        try {
          decision = await this.input.requestApproval(event);
        } catch {
          decision = "deny";
        }
        await this.application.resolveApproval(event.approvalId, decision);
      });
      await this.approvalQueue;
      return;
    }

    this.renderer.render(event);
  }
}
