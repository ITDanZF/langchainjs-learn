import { afterEach, describe, expect, it, vi } from "vitest";
import RunBudget, {
  createRunAbortScope,
} from "../../src/Agent/RunLimits.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("RunLimits", () => {
  it("counts tool calls and rejects calls over budget", () => {
    const budget = new RunBudget({
      maxTurns: 1,
      maxToolCalls: 1,
      timeoutMs: 100,
      maxDelegationDepth: 0,
    });

    budget.consumeToolCall("first");

    expect(budget.getToolCallCount()).toBe(1);
    expect(() => budget.consumeToolCall("second")).toThrow(
      "Tool call budget exceeded",
    );
  });

  it("aborts and reports when a run reaches its timeout", async () => {
    vi.useFakeTimers();
    const scope = createRunAbortScope(50);

    await vi.advanceTimersByTimeAsync(50);

    expect(scope.signal.aborted).toBe(true);
    expect(scope.timedOut()).toBe(true);
    scope.dispose();
  });
});
