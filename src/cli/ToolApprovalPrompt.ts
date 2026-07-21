import { select } from "@inquirer/prompts";
import type {
  ToolApprovalDecision,
  ToolApprovalHandler,
  ToolApprovalRequest,
} from "../security/ToolPolicy.ts";

const MAX_PREVIEW_LENGTH = 4_000;

function truncate(value: string): string {
  if (value.length <= MAX_PREVIEW_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_PREVIEW_LENGTH)}\n… preview truncated …`;
}

function renderChangePreview(request: ToolApprovalRequest): string {
  if (!request.input || typeof request.input !== "object") {
    return "";
  }

  const input = request.input as Record<string, unknown>;

  if (request.toolName === "edit_file") {
    const oldValue = typeof input.old_string === "string" ? input.old_string : "";
    const newValue = typeof input.new_string === "string" ? input.new_string : "";
    return truncate(["--- existing", oldValue, "+++ proposed", newValue].join("\n"));
  }

  if (request.toolName === "write_file") {
    const content = typeof input.content === "string" ? input.content : "";
    return truncate(["+++ proposed content", content].join("\n"));
  }

  return "";
}

export const promptForToolApproval: ToolApprovalHandler = async (request) => {
  const preview = renderChangePreview(request);
  process.stdout.write(
    `\n\x1b[33m工具授权请求：${request.summary}\x1b[0m\n${preview}${preview ? "\n" : ""}`,
  );

  return select<ToolApprovalDecision>({
    message: "是否允许执行？",
    choices: [
      { name: "仅允许本次", value: "allow_once" },
      { name: "本次会话始终允许此工具", value: "allow_session" },
      { name: "拒绝", value: "deny" },
    ],
    default: "deny",
  });
};
