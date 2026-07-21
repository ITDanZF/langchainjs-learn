import { describe, expect, it } from "vitest";

import AgentApplication from "../../src/application/AgentApplication.js";
import type { AgentRunner, AgentRunnerRunOptions } from "../../src/application/ports.js";
import type { ApplicationEvent } from "../../src/application/contracts.js";

class ApprovalRunner implements AgentRunner {
  async run(input: string, options: AgentRunnerRunOptions): Promise<string> {
    const decision = await options.approval?.({
      toolName: "write_file",
      input: { path: "notes.txt", content: input },
      summary: "Writes a file",
    });
    options.onChunk?.("done");
    return `decision=${decision}`;
  }

  cancelRun(): boolean {
    return false;
  }
}

class CancellableRunner implements AgentRunner {
  private rejectRun?: (reason: Error) => void;

  run(): Promise<string> {
    return new Promise((_resolve, reject) => {
      this.rejectRun = reject;
    });
  }

  cancelRun(_runId: string, reason = "Run cancelled"): boolean {
    if (!this.rejectRun) {
      return false;
    }
    this.rejectRun(new Error(reason));
    return true;
  }
}

describe("AgentApplication", () => {
  it("coordinates approval through serializable application events", async () => {
    const application = new AgentApplication(new ApprovalRunner());
    const events: ApplicationEvent[] = [];

    application.subscribe(async (event: ApplicationEvent) => {
      events.push(event);
      if (event.type === "approval_requested") {
        application.resolveApproval(event.approvalId, "allow_once");
      }
    });

    const runId = application.startRun({ input: "hello", threadId: "thread-1" });
    const result = await application.waitForRun(runId);

    expect(result).toBe("decision=allow_once");
    expect(application.getRun(runId)).toEqual(
      expect.objectContaining({
        runId,
        threadId: "thread-1",
        status: "completed",
        content: "decision=allow_once",
      }),
    );
    expect(() => JSON.stringify(application.listRuns())).not.toThrow();
    expect(events.map((event) => event.type)).toEqual([
      "run_started",
      "approval_requested",
      "approval_resolved",
      "text_delta",
      "run_completed",
    ]);
    expect(() => JSON.stringify(events)).not.toThrow();
  });

  it("exposes cancellation as an application operation", async () => {
    const application = new AgentApplication(new CancellableRunner());
    const events: ApplicationEvent[] = [];
    application.subscribe((event: ApplicationEvent) => {
      events.push(event);
    });

    const runId = application.startRun({ input: "wait", threadId: "thread-1" });
    await Promise.resolve();
    await Promise.resolve();
    expect(application.cancelRun(runId)).toBe(true);
    expect(application.getRun(runId)?.status).toBe("cancelling");
    await expect(application.waitForRun(runId)).rejects.toThrow("Run cancelled by user");
    expect(application.getRun(runId)?.status).toBe("aborted");
    expect(events.some((event) => event.type === "run_aborted")).toBe(true);
  });
});
