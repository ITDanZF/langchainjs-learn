import { describe, expect, it } from "vitest";

import { defineAgent } from "../../../src/Agent/AgentDefinition.js";
import AgentRegistry from "../../../src/Agent/AgentRegistry.js";
import PlanValidator from "../../../src/Agent/orchestration/PlanValidator.js";
import type { PlannedExecutionPlan } from "../../../src/Agent/orchestration/contracts.js";

function createPlan(): PlannedExecutionPlan {
  return {
    version: 1,
    planId: "plan-1",
    mode: "planned",
    goal: "Compare two analyses",
    tasks: [
      {
        id: "task_a",
        title: "Analyze",
        objective: "Analyze source A",
        agentType: "worker",
        dependsOn: [],
        required: true,
        expectedOutput: "Analysis",
        acceptanceCriteria: ["Complete"],
        sideEffect: "none",
        timeoutMs: 10_000,
        maxAttempts: 2,
      },
      {
        id: "task_b",
        title: "Review",
        objective: "Review analysis A",
        agentType: "worker",
        dependsOn: ["task_a"],
        required: true,
        expectedOutput: "Review",
        acceptanceCriteria: ["Uses task A"],
        sideEffect: "none",
        timeoutMs: 10_000,
        maxAttempts: 2,
      },
    ],
    finalAcceptanceCriteria: ["Answer the goal"],
  };
}

function createValidator() {
  return new PlanValidator(new AgentRegistry([
    defineAgent({
      id: "worker",
      name: "Worker",
      description: "Test worker",
      systemPrompt: "Work",
      tools: [],
    }),
  ]));
}

describe("PlanValidator", () => {
  it("accepts a valid dependency graph", () => {
    const plan = createPlan();
    expect(createValidator().validate(plan)).toBe(plan);
  });

  it("rejects cycles and unknown agents", () => {
    const plan = createPlan();
    const cyclic = {
      ...plan,
      tasks: [
        { ...plan.tasks[0], dependsOn: ["task_b"] },
        plan.tasks[1],
      ],
    };
    expect(() => createValidator().validate(cyclic)).toThrow("dependency cycle");

    const unknownAgent = {
      ...plan,
      tasks: [{ ...plan.tasks[0], agentType: "missing" }, plan.tasks[1]],
    };
    expect(() => createValidator().validate(unknownAgent)).toThrow("Unknown agent");
  });
});
