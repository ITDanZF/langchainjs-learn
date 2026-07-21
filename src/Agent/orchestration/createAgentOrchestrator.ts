import Model from "../../model/Model.ts";
import ToolResolver from "../../tools/ToolResolver.ts";
import ToolPolicy, { denyToolApproval } from "../../security/ToolPolicy.ts";
import AgentGenerator from "../AgentGenerator.ts";
import AgentRuntime from "../AgentRuntime.ts";
import { createBuiltInAgentRegistry } from "../builtInAgents.ts";
import { DEFAULT_RUN_LIMITS, type RunLimits } from "../RunLimits.ts";
import AgentOrchestrator from "./AgentOrchestrator.ts";
import AgentTaskRunner from "./AgentTaskRunner.ts";
import AnswerSynthesizer from "./AnswerSynthesizer.ts";
import ResultReviewer from "./ResultReviewer.ts";
import TaskPlanner from "./TaskPlanner.ts";
import TaskScheduler from "./TaskScheduler.ts";

export function createAgentOrchestrator(
  limits: RunLimits = DEFAULT_RUN_LIMITS,
): AgentOrchestrator {
  const model = new Model();
  const registry = createBuiltInAgentRegistry();
  const toolResolver = new ToolResolver();
  const policy = new ToolPolicy();
  const directRunner = new AgentGenerator({
    model,
    registry,
    toolResolver,
    policy,
    limits,
  });
  const taskRuntime = new AgentRuntime(
    registry,
    model,
    toolResolver,
    policy,
    denyToolApproval,
  );
  const scheduler = new TaskScheduler(
    new AgentTaskRunner(taskRuntime),
    new ResultReviewer(model),
    new AnswerSynthesizer(model),
  );

  return new AgentOrchestrator(
    directRunner,
    new TaskPlanner(model, registry),
    scheduler,
    limits,
  );
}
