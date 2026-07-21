import { select, password, input } from "@inquirer/prompts";
import {
  MODEL_PROVIDER_OPTIONS,
  ModelProvider,
} from "../enum/ModelProvider.constant.ts";
import Configuration from "../config/index.ts";
import WorkSpace from "../workspace/index.ts";
// import AgentModel from "../model/index.ts";

export default class Bootstrap {
  private configuration = new Configuration();
  private workspace = new WorkSpace();

  constructor() {}

  async setup() {
    await this.initDir();

    const configInfo = this.configuration.loadConfig();
    if (!configInfo) {
      await this.initBaseInfo();
    }

    // const AgentRuntime = new AgentModel().getActiveAgent();

    // return {
    //   AgentRuntime,
    // };
  }

  async initDir() {
    await this.workspace.createHomeRoot();
    await this.workspace.createAgentWorkSpace();
  }

  async initBaseInfo() {
    const options = Object.entries(MODEL_PROVIDER_OPTIONS).map(
      ([value, item]) => ({
        name: `${item.label} (${item.defaultModel})`,
        value: value as ModelProvider,
        description: item.baseURL,
      }),
    );

    const provide: ModelProvider = await select({
      message: "模型提供商",
      choices: options,
    });

    const providerConfig = MODEL_PROVIDER_OPTIONS[provide];

    const apiKey = await password({
      message: `${providerConfig.label} API key`,
      mask: "*",
    });

    const workspace = await input({
      message: "工作目录路径",
      default: "",
    });

    this.configuration.saveConfig({
      MODEL_PROVIDER: provide,
      MODEL_NAME: providerConfig.defaultModel,
      MODEL_BASE_URL: providerConfig.baseURL,
      MODEL_API_KEY: apiKey,
      AGENT_WORKSPACE: workspace,
    });
  }
}
