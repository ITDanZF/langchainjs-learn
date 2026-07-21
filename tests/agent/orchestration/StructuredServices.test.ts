import { describe, expect, it, vi } from "vitest";

import { defineAgent } from "../../../src/Agent/AgentDefinition.js";
import AgentRegistry from "../../../src/Agent/AgentRegistry.js";
import ResultReviewer from "../../../src/Agent/orchestration/ResultReviewer.js";
import TaskPlanner from "../../../src/Agent/orchestration/TaskPlanner.js";
import type { OrchestrationTextModel } from "../../../src/Agent/orchestration/ports.js";

function registry() {
  return new AgentRegistry([
    defineAgent({
      id: "worker",
      name: "Worker",
      description: "Analyze text",
      systemPrompt: "Work",
      tools: [],
    }),
  ]);
}

describe("structured orchestration services", () => {
  it("retries one invalid planner response and validates the correction", async () => {
    const responses = [
      "not json",
      '{"version":1,"mode":"direct","goal":"hello"}',
    ];
    const model: OrchestrationTextModel = {
      invokeText: vi.fn(async () => responses.shift() ?? ""),
    };

    const plan = await new TaskPlanner(model, registry()).createPlan({
      runId: "run-1",
      threadId: "thread-1",
      goal: "hello",
    });

    expect(plan.mode).toBe("direct");
    expect(plan.planId).toMatch(/^plan_/);
    expect(model.invokeText).toHaveBeenCalledTimes(2);
  });

  it("uses deterministic review before spending a model call", async () => {
    const model: OrchestrationTextModel = {
      invokeText: vi.fn(async () => "unused"),
    };
    const reviewer = new ResultReviewer(model);
    const review = await reviewer.review({
      rootRunId: "run-1",
      threadId: "thread-1",
      task: {
        id: "task_a",
        title: "Task",
        objective: "Work",
        agentType: "worker",
        dependsOn: [],
        required: true,
        expectedOutput: "Output",
        acceptanceCriteria: ["Complete"],
        sideEffect: "none",
        timeoutMs: 10_000,
        maxAttempts: 2,
      },
      result: {
        taskId: "task_a",
        agentRunId: "agent-1",
        agentType: "worker",
        attempt: 1,
        status: "failed",
        content: "",
        startedAt: new Date(0).toISOString(),
        completedAt: new Date(1).toISOString(),
        durationMs: 1,
        error: "failed",
      },
      dependencyResults: [],
    });

    expect(review.decision).toBe("retry");
    expect(model.invokeText).not.toHaveBeenCalled();
  });

  it("parses a structured semantic review", async () => {
    const model: OrchestrationTextModel = {
      invokeText: vi.fn(async () =>
        '{"decision":"pass","score":0.9,"findings":[{"criterion":"Complete","passed":true,"severity":"info","message":"Satisfied"}]}'
      ),
    };
    const reviewer = new ResultReviewer(model);
    const review = await reviewer.review({
      rootRunId: "run-1",
      threadId: "thread-1",
      task: {
        id: "task_a",
        title: "Task",
        objective: "Work",
        agentType: "worker",
        dependsOn: [],
        required: true,
        expectedOutput: "Output",
        acceptanceCriteria: ["Complete"],
        sideEffect: "none",
        timeoutMs: 10_000,
        maxAttempts: 2,
      },
      result: {
        taskId: "task_a",
        agentRunId: "agent-1",
        agentType: "worker",
        attempt: 1,
        status: "completed",
        content: "complete output",
        startedAt: new Date(0).toISOString(),
        completedAt: new Date(1).toISOString(),
        durationMs: 1,
      },
      dependencyResults: [],
    });

    expect(review).toEqual(expect.objectContaining({ decision: "pass", score: 0.9 }));
  });
});
