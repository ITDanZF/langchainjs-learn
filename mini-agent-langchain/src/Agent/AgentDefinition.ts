import { AgentDefinitionOptions } from "./types.d.ts";
export default class AgentDefinition {
  public readonly agentType: string;
  public readonly whenToUse: string;

  private readonly systemPromptFactory: () => string;

  constructor(options: AgentDefinitionOptions) {
    this.agentType = options.agentType;
    this.whenToUse = options.whenToUse;
    this.systemPromptFactory = options.getSystemPrompt;
  }

  public getSystemPrompt(): string {
    return this.systemPromptFactory();
  }
}
