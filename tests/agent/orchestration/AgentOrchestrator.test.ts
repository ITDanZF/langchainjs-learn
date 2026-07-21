import { describe, expect, it, vi } from "vitest";

import AgentOrchestrator, {
  type DirectAgentRunner,
  type PlanScheduler,
} from "../../../src/Agent/orchestration/AgentOrchestrator.js";
import type { ExecutionPlan } from "../../../src/Agent/orchestration/contracts.js";
import type { PlanProvider } from "../../../src/Agent/orchestration/ports.js";

const limits = {
  maxTurns: 8,
  maxToolCalls: 20,
  timeoutMs: 10_000,
  maxDelegationDepth: 1,
};

function runOptions() {
  return {
    runId: "run-1",
    threadId: "thread-1",
    approval: async () => "deny" as const,
    onChunk: vi.fn(async () => undefined),
    onAgentEvent: vi.fn(async () => undefined),
    onOrchestrationEvent: vi.fn(async () => undefined),
  };
}

function directRunner(): DirectAgentRunner {
  return {
    run: vi.fn(async () => "direct-result"),
    cancelRun: vi.fn(() => true),
  };
}

describe("AgentOrchestrator", () => {
  it("preserves the existing direct execution path", async () => {
    const direct = directRunner();
    const planner: PlanProvider = {
      createPlan: async (): Promise<ExecutionPlan> => ({
        version: 1,
        planId: "plan-direct",
        mode: "direct",
        goal: "hello",
      }),
    };
    const scheduler: PlanScheduler = { run: vi.fn(async () => "planned") };
    const options = runOptions();

    await expect(
      new AgentOrchestrator(direct, planner, scheduler, limits).run("hello", options),
    ).resolves.toBe("direct-result");
    expect(direct.run).toHaveBeenCalledOnce();
    expect(scheduler.run).not.toHaveBeenCalled();
    expect(options.onOrchestrationEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "plan_created" }),
    );
  });

  it("routes planned work through the scheduler and publishes final content", async () => {
    const planner: PlanProvider = {
      createPlan: async () => ({
        version: 1,
        planId: "plan-1",
        mode: "planned",
        goal: "analyze",
        tasks: [],
        finalAcceptanceCriteria: ["complete"],
      }),
    };
    const scheduler: PlanScheduler = { run: vi.fn(async () => "planned-result") };
    const options = runOptions();

    await expect(
      new AgentOrchestrator(directRunner(), planner, scheduler, limits).run(
        "analyze",
        options,
      ),
    ).resolves.toBe("planned-result");
    expect(scheduler.run).toHaveBeenCalledOnce();
    expect(options.onChunk).toHaveBeenCalledWith("planned-result");
  });

  it("propagates cancellation while planning", async () => {
    const planner: PlanProvider = {
      createPlan: (request) => new Promise((_resolve, reject) => {
        request.signal?.addEventListener("abort", () => {
          reject(request.signal?.reason);
        }, { once: true });
      }),
    };
    const orchestrator = new AgentOrchestrator(
      directRunner(),
      planner,
      { run: vi.fn(async () => "unused") },
      limits,
    );
    const running = orchestrator.run("wait", runOptions());
    await Promise.resolve();

    expect(orchestrator.cancelRun("run-1", new Error("stop"))).toBe(true);
    await expect(running).rejects.toThrow("stop");
  });
});
