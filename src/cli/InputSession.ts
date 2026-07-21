import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { Interface } from "node:readline/promises";
import type { ToolApprovalDecision } from "../security/ToolPolicy.ts";
import type { ApplicationEvent } from "../application/contracts.ts";

export type InputSessionIO = {
  readonly question: (prompt: string) => Promise<string>;
  readonly write: (value: string) => void;
  readonly close: () => void;
};

function createDefaultIO(): InputSessionIO {
  const readline: Interface = createInterface({ input: stdin, output: stdout });
  return {
    question: (prompt) => readline.question(prompt),
    write: (value) => stdout.write(value),
    close: () => readline.close(),
  };
}

export default class InputSession {
  constructor(private readonly io: InputSessionIO = createDefaultIO()) {}

  async readMessage(): Promise<string> {
    const line = (await this.io.question("> ")).trim();
    if (line.toLowerCase() !== "/paste") {
      return line;
    }

    this.io.write("多行输入模式，单独输入 .end 提交。\n");
    const lines: string[] = [];
    while (true) {
      const nextLine = await this.io.question("| ");
      if (nextLine.trim().toLowerCase() === ".end") {
        return lines.join("\n").trim();
      }
      lines.push(nextLine);
    }
  }

  async requestApproval(
    event: Extract<ApplicationEvent, { type: "approval_requested" }>,
  ): Promise<ToolApprovalDecision> {
    this.io.write(
      [
        "",
        `\x1b[33m工具授权请求：${event.summary}\x1b[0m`,
        event.preview,
        "[1] 仅允许本次",
        "[2] 本次会话始终允许此工具",
        "[3] 拒绝（默认）",
      ].filter(Boolean).join("\n") + "\n",
    );

    const answer = (await this.io.question("请选择 [1/2/3]：")).trim();
    if (answer === "1") {
      return "allow_once";
    }
    if (answer === "2") {
      return "allow_session";
    }
    return "deny";
  }

  write(value: string): void {
    this.io.write(value);
  }

  close(): void {
    this.io.close();
  }
}
