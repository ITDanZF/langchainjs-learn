import AgentModel from "../model/index.ts";
export default class AgentGenerator {
  private agent;
  private state;
  constructor() {
    this.agent = new AgentModel().getActiveAgent();
  }

  async *Query(): AsyncGenerator {}

  async AgentRuntime(input: string) {}
}
