import { Command } from "commander";
import InputSession from "./InputSession.ts";

type InputHandler = (input: string) => Promise<void> | void;

export default class CLI {
  private readonly program = new Command();

  constructor(private readonly input: InputSession) {
    this.program
      .name("mini-agent")
      .description("A mini Agent CLI")
      .version("0.1.0");
  }

  async run(argv: string[], handleInput: InputHandler): Promise<void> {
    this.program.action(async () => this.loop(handleInput));

    try {
      await this.program.parseAsync(argv);
    } catch (error) {
      this.handleError(error);
      process.exitCode = 1;
    } finally {
      this.input.close();
    }
  }

  private async loop(handleInput: InputHandler): Promise<void> {
    while (true) {
      const message = await this.input.readMessage();
      if (!message) {
        continue;
      }
      if (this.isExitCommand(message)) {
        this.input.write("已退出 Mini Agent，再见！\n");
        return;
      }

      try {
        await handleInput(message);
      } catch (error) {
        this.handleError(error);
      }
    }
  }

  private isExitCommand(input: string): boolean {
    const command = input.trim().toLowerCase();
    return ["/exit", "/quit", "exit", "quit", "q", "退出"].includes(command);
  }

  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.input.write(`\x1b[31m运行失败：\x1b[0m${message}\n`);

    if (
      error instanceof Error &&
      process.env.NODE_ENV === "development" &&
      error.stack
    ) {
      this.input.write(`\x1b[90m${error.stack}\x1b[0m\n`);
    }
  }
}
