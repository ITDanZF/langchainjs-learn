import { tool } from "langchain";
import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import RunBudget from "../../src/Agent/RunLimits.ts";
import { guardTools } from "../../src/security/GuardedTool.ts";
import ToolPolicy from "../../src/security/ToolPolicy.ts";

function createTestTool(run: (value: string) => string) {
  return tool(
    async ({ value }) => run(value),
    {
      name: "write_file",
      description: "Test write tool",
      schema: z.object({ value: z.string() }),
    },
  );
}

describe("guardTools", () => {
  it("does not execute a tool when the user rejects approval", async () => {
    const execute = vi.fn((value: string) => value);
    const onEvent = vi.fn();
    const [guarded] = guardTools([createTestTool(execute)], {
      policy: new ToolPolicy({ write_file: "ask" }),
      approval: async () => "deny",
      onEvent,
    });

    const result = await guarded!.invoke({ value: "secret" });

    expect(result).toContain("denied by user");
    expect(execute).not.toHaveBeenCalled();
    expect(onEvent.mock.calls.map(([event]) => event.type)).toEqual([
      "tool_approval_requested",
      "tool_rejected",
    ]);
  });

  it("supports session approval and enforces the shared tool budget", async () => {
    const execute = vi.fn((value: string) => value.toUpperCase());
    const approval = vi.fn(async () => "allow_session" as const);
    const budget = new RunBudget({
      maxTurns: 2,
      maxToolCalls: 1,
      timeoutMs: 1_000,
      maxDelegationDepth: 1,
    });
    const [guarded] = guardTools([createTestTool(execute)], {
      policy: new ToolPolicy({ write_file: "ask" }),
      approval,
      budget,
    });

    await expect(guarded!.invoke({ value: "first" })).resolves.toBe("FIRST");
    await expect(guarded!.invoke({ value: "second" })).rejects.toThrow(
      "Tool call budget exceeded",
    );
    expect(approval).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
