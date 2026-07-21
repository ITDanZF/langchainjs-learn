import { describe, expect, it, vi } from "vitest";

import RunBudget from "../../../src/Agent/RunLimits.js";
import TaskScheduler from "../../../src/Agent/orchestration/TaskScheduler.js";
import type {
  PlannedExecutionPlan,
  ReviewResult,
} from "../../../src/Agent/orchestration/contracts.js";
import type {
  AnswerSynthesisProvider,
  PlannedTaskRunner,
  ResultReviewProvider,
  SynthesisRequest,
  TaskExecutionRequest,
} from "../../../src/Agent/orchestration/ports.js";

function createPlan(maxAttempts = 2): PlannedExecutionPlan {
  return {
    version: 1,
    planId: "plan-1",
    mode: "planned",
    goal: "Build a reviewed answer",
    tasks: [
      {
        id: "task_a",
        title: "Analyze",
        objective: "Analyze input",
        agentType: "worker",
        dependsOn: [],
        required: true,
        expectedOutput: "Analysis",
        acceptanceCriteria: ["Complete"],
        sideEffect: "none",
        timeoutMs: 10_000,
        maxAttempts,
      },
      {
        id: "task_b",
        title: "Review",
        objective: "Review analysis",
        agentType: "worker",
        dependsOn: ["task_a"],
        required: true,
        expectedOutput: "Review",
        acceptanceCriteria: ["Uses dependency"],
        sideEffect: "none",
        timeoutMs: 10_000,
        maxAttempts,
      },
    ],
    finalAcceptanceCriteria: ["Complete answer"],
  };
}

const passReview: ReviewResult = {
  decision: "pass",
  score: 1,
  findings: [],
};

function scheduleInput(plan: PlannedExecutionPlan) {
  return {
    runId: "run-1",
    threadId: "thread-1",
    goal: plan.goal,
    plan,
    budget: new RunBudget(),
    approval: async () => "deny" as const,
    onAgentEvent: async () => undefined,
  };
}

describe("TaskScheduler", () => {
  it("executes dependencies in order and synthesizes only approved results", async () => {
    const executionOrder: string[] = [];
    const runner: PlannedTaskRunner = {
      runTask: vi.fn(async (request: TaskExecutionRequest) => {
        executionOrder.push(request.task.id);
        if (request.task.id === "task_b") {
          expect(request.dependencyResults.map((item) => item.taskId)).toEqual(["task_a"]);
        }
        return {
          status: "completed" as const,
          runId: `agent-${request.task.id}`,
          agentType: request.task.agentType,
          threadId: "agent-thread",
          content: `result-${request.task.id}`,
        };
      }),
    };
    const reviewer: ResultReviewProvider = {
      review: vi.fn(async () => passReview),
    };
    const synthesizer: AnswerSynthesisProvider = {
      synthesize: vi.fn(async (request: SynthesisRequest) => {
        expect(request.results.map((item) => item.taskId)).toEqual(["task_a", "task_b"]);
        return "final";
      }),
    };
    const scheduler = new TaskScheduler(runner, reviewer, synthesizer);

    await expect(scheduler.run(scheduleInput(createPlan()))).resolves.toBe("final");
    expect(executionOrder).toEqual(["task_a", "task_b"]);
  });

  it("retries once with reviewer feedback", async () => {
    const plan = { ...createPlan(), tasks: [createPlan().tasks[0]] };
    const runner: PlannedTaskRunner = {
      runTask: vi.fn(async (request: TaskExecutionRequest) => {
        if (request.attempt === 2) {
          expect(request.retryInstruction).toBe("Add evidence");
          expect(request.previousResult?.content).toBe("draft-1");
        }
        return {
          status: "completed" as const,
          runId: `agent-${request.attempt}`,
          agentType: request.task.agentType,
          threadId: "agent-thread",
          content: `draft-${request.attempt}`,
        };
      }),
    };
    let reviewCount = 0;
    const reviewer: ResultReviewProvider = {
      review: vi.fn(async () => {
        reviewCount += 1;
        return reviewCount === 1
          ? {
              decision: "retry" as const,
              score: 0.4,
              findings: [],
              retryInstruction: "Add evidence",
            }
          : passReview;
      }),
    };
    const synthesizer: AnswerSynthesisProvider = {
      synthesize: vi.fn(async () => "revised-final"),
    };

    await expect(
      new TaskScheduler(runner, reviewer, synthesizer).run(scheduleInput(plan)),
    ).resolves.toBe("revised-final");
    expect(runner.runTask).toHaveBeenCalledTimes(2);
  });

  it("does not synthesize when a required task fails review", async () => {
    const plan = { ...createPlan(1), tasks: [createPlan(1).tasks[0]] };
    const runner: PlannedTaskRunner = {
      runTask: async (request) => ({
        status: "completed",
        runId: "agent-1",
        agentType: request.task.agentType,
        threadId: "agent-thread",
        content: "bad",
      }),
    };
    const reviewer: ResultReviewProvider = {
      review: async () => ({ decision: "fail", score: 0, findings: [] }),
    };
    const synthesizer: AnswerSynthesisProvider = {
      synthesize: vi.fn(async () => "must-not-run"),
    };

    await expect(
      new TaskScheduler(runner, reviewer, synthesizer).run(scheduleInput(plan)),
    ).rejects.toThrow("Required task failed review");
    expect(synthesizer.synthesize).not.toHaveBeenCalled();
  });
});
