export type CommandHandler<TContext = unknown> = (
  args: string[],
  rawInput: string,
  context: TContext,
) => Promise<void> | void;

export type UnknownCommandHandler<TContext = unknown> = (
  command: ParsedCommand,
  rawInput: string,
  context: TContext,
) => Promise<void> | void;

export type CommandDefinition<TContext = unknown> = {
  name: string;
  aliases?: string[];
  usage: string;
  description: string;
  hidden?: boolean;
  handler: CommandHandler<TContext>;
};

export type ParsedCommand = {
  name: string;
  args: string[];
};

export type CommandOptions<TContext = unknown> = {
  unknownCommandHandler?: UnknownCommandHandler<TContext>;
};

export type CommandExecuteResult =
  | {
      type: "continue";
      input: string;
    }
  | {
      type: "stop";
      command?: ParsedCommand;
    };

export default class Command<TContext = unknown> {
  private readonly commands = new Map<string, CommandDefinition<TContext>>();
  private readonly aliases = new Map<string, string>();
  private readonly unknownCommandHandler?: UnknownCommandHandler<TContext>;

  constructor(
    commands: CommandDefinition<TContext>[] = [],
    options: CommandOptions<TContext> = {},
  ) {
    this.unknownCommandHandler = options.unknownCommandHandler;
    this.registerMany(commands);
  }

  register(command: CommandDefinition<TContext>) {
    const name = this.normalizeName(command.name);

    if (this.commands.has(name)) {
      throw new Error(`Command already registered: ${name}`);
    }

    this.commands.set(name, {
      ...command,
      name,
    });

    for (const alias of command.aliases ?? []) {
      const normalizedAlias = this.normalizeName(alias);

      if (this.commands.has(normalizedAlias) || this.aliases.has(normalizedAlias)) {
        throw new Error(`Command alias already registered: ${normalizedAlias}`);
      }

      this.aliases.set(normalizedAlias, name);
    }
  }

  registerMany(commands: CommandDefinition<TContext>[]) {
    for (const command of commands) {
      this.register(command);
    }
  }

  list() {
    return Array.from(this.commands.values());
  }

  listVisible() {
    return this.list().filter((command) => !command.hidden);
  }

  find(name: string) {
    const normalizedName = this.normalizeName(name);
    const commandName = this.aliases.get(normalizedName) ?? normalizedName;

    return this.commands.get(commandName);
  }

  parse(input: string): ParsedCommand | null {
    const trimmed = input.trim();

    if (!trimmed.startsWith("/")) {
      return null;
    }

    const [rawName, ...args] = trimmed.slice(1).split(/\s+/);

    if (!rawName) {
      return null;
    }

    return {
      name: this.normalizeName(rawName),
      args,
    };
  }

  async execute(input: string, context: TContext): Promise<CommandExecuteResult> {
    const parsed = this.parse(input);

    if (!parsed) {
      return {
        type: "continue",
        input,
      };
    }

    const command = this.find(parsed.name);

    if (!command) {
      await this.unknownCommandHandler?.(parsed, input, context);

      return {
        type: "stop",
        command: parsed,
      };
    }

    await command.handler(parsed.args, input, context);
    return {
      type: "stop",
      command: parsed,
    };
  }

  private normalizeName(name: string) {
    return name.trim().replace(/^\//, "").toLowerCase();
  }
}
