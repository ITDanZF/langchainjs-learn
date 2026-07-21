import type { ApplicationEvent } from "../application/contracts.ts";
import type InputSession from "./InputSession.ts";

export default class CliEventRenderer {
  constructor(private readonly input: InputSession) {}

  render(event: ApplicationEvent): void {
    switch (event.type) {
      case "text_delta":
        this.input.write(event.content);
        break;
      case "agent_status":
        this.input.write(
          `\n[agent] ${event.status} ${event.agentType} (${event.agentRunId})\n`,
        );
        break;
      case "plan_created":
        if (event.plan.mode === "planned") {
          this.input.write(
            `\n[plan] created ${event.plan.tasks.length} tasks (${event.plan.planId})\n`,
          );
        }
        break;
      case "task_started":
        this.input.write(
          `\n[task] started ${event.taskId} with ${event.agentType} (attempt ${event.attempt})\n`,
        );
        break;
      case "task_reviewed":
        this.input.write(
          `\n[review] ${event.taskId} ${event.decision} (score ${event.score})\n`,
        );
        break;
      case "task_retrying":
        this.input.write(
          `\n[task] retrying ${event.taskId} (attempt ${event.nextAttempt})\n`,
        );
        break;
      case "task_failed":
      case "task_skipped":
        this.input.write(
          `\n[task] ${event.type.replace("task_", "")} ${event.taskId}: ${event.error ?? "unknown"}\n`,
        );
        break;
      case "task_completed":
      case "synthesis_started":
      case "synthesis_completed":
        break;
      case "tool_status":
        if (event.status === "failed") {
          this.input.write(
            `\n[tool] failed ${event.toolName}: ${event.error ?? "unknown error"}\n`,
          );
        }
        break;
      case "run_aborted":
        this.input.write("\n当前任务已取消。\n");
        break;
      case "run_timed_out":
        this.input.write(`\n任务超时：${event.error.message}\n`);
        break;
      case "run_failed":
        this.input.write(`\n任务失败：${event.error.message}\n`);
        break;
      case "run_started":
      case "run_completed":
      case "approval_requested":
      case "approval_resolved":
        break;
    }
  }
}
