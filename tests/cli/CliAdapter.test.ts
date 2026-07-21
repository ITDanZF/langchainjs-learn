import { describe, expect, it } from "vitest";

import AgentApplication from "../../src/application/AgentApplication.js";
import type { AgentRunner, AgentRunnerRunOptions } from "../../src/application/ports.js";
import CliAdapter from "../../src/cli/CliAdapter.js";
import InputSession, { type InputSessionIO } from "../../src/cli/InputSession.js";

class RepeatedApprovalRunner implements AgentRunner {
  async run(_input: string, options: AgentRunnerRunOptions): Promise<string> {
    const decision = await options.approval?.({
      toolName: "write_file",
      input: { path: "notes.txt", content: "test" },
      summary: "Writes a file",
    });
    return decision ?? "missing";
  }

  cancelRun(): boolean {
    return false;
  }
}

describe("CliAdapter", () => {
  it("keeps one input session alive across multiple runs and approvals", async () => {
    const answers = ["1", "3"];
    let closeCount = 0;
    const io: InputSessionIO = {
      question: async () => answers.shift() ?? "",
      write: () => undefined,
      close: () => {
        closeCount += 1;
      },
    };
    const session = new InputSession(io);
    const application = new AgentApplication(new RepeatedApprovalRunner());
    const adapter = new CliAdapter(application, session);

    await expect(adapter.runTask("thread-1", "first")).resolves.toBe("allow_once");
    await expect(adapter.runTask("thread-1", "second")).resolves.toBe("deny");
    expect(closeCount).toBe(0);
    adapter.dispose();
  });

  it("denies an approval if the input channel fails instead of hanging the run", async () => {
    const io: InputSessionIO = {
      question: async () => {
        throw new Error("input closed");
      },
      write: () => undefined,
      close: () => undefined,
    };
    const application = new AgentApplication(new RepeatedApprovalRunner());
    const adapter = new CliAdapter(application, new InputSession(io));

    await expect(adapter.runTask("thread-1", "work")).resolves.toBe("deny");
    adapter.dispose();
  });
});
