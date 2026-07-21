import { describe, expect, it } from "vitest";

import InputSession, { type InputSessionIO } from "../../src/cli/InputSession.js";

function createIO(answers: string[]) {
  let closeCount = 0;
  const output: string[] = [];
  const io: InputSessionIO = {
    question: async () => answers.shift() ?? "",
    write: (value) => output.push(value),
    close: () => {
      closeCount += 1;
    },
  };
  return { io, output, getCloseCount: () => closeCount };
}

describe("InputSession", () => {
  it("collects multiline paste input until .end", async () => {
    const fake = createIO(["/paste", "first", "second", ".end"]);
    const session = new InputSession(fake.io);

    await expect(session.readMessage()).resolves.toBe("first\nsecond");
    expect(fake.getCloseCount()).toBe(0);
  });

  it("uses the same open input session for repeated approvals", async () => {
    const fake = createIO(["1", "2", ""]);
    const session = new InputSession(fake.io);
    const request = {
      type: "approval_requested" as const,
      approvalId: "approval-1",
      runId: "run-1",
      toolName: "write_file",
      summary: "Writes a file",
      preview: "notes.txt",
      timestamp: new Date(0).toISOString(),
    };

    await expect(session.requestApproval(request)).resolves.toBe("allow_once");
    await expect(session.requestApproval({ ...request, approvalId: "approval-2" })).resolves.toBe(
      "allow_session",
    );
    await expect(session.requestApproval({ ...request, approvalId: "approval-3" })).resolves.toBe("deny");
    expect(fake.getCloseCount()).toBe(0);
  });
});
