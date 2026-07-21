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
