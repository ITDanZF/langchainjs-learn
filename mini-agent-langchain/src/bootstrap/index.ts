import { select, password, input } from "@inquirer/prompts";
import {
  MODEL_PROVIDER_OPTIONS,
  ModelProvider,
} from "../enum/ModelProvider.constant.ts";
import Configuration from "../config/index.ts";
import WorkSpace from "../workspace/index.ts";
import AgentModel from "../model/index.ts";

export default class Bootstrap {
  // 初始化配置类对象
  private configuration = new Configuration();

  // 初始化工作目录对象
  private workspace = new WorkSpace();

  // 初始化模型对象
  private agentModel = new AgentModel();

  constructor() {}

  /**
   * 初始化
   */
  async setup() {
    // 初始化目录
    await this.initDir();

    // 初始化配置文件信息
    const configInfo = this.configuration.loadConfig();
    if (!configInfo) {
      await this.initBaseInfo();
    }

    // 开启模型
    const model = this.agentModel.createChatModel();

    return {
      model,
    };
  }

  /**
   * 初始化用户目录 和 工作目录
   */
  async initDir() {
    await this.workspace.createHomeRoot();
    await this.workspace.createAgentWorkSpace();
  }

  /**
   * 初始化信息
   */
  async initBaseInfo() {
    const options = Object.entries(MODEL_PROVIDER_OPTIONS).map(
      ([value, item]) => ({
        name: `${item.label} (${item.defaultModel})`,
        value: value as ModelProvider,
        description: item.baseURL,
      }),
    );

    const provide: ModelProvider = await select({
      message: "请选择一个模型提供商：",
      choices: options,
    });

    const providerConfig = MODEL_PROVIDER_OPTIONS[provide];

    const apiKey = await password({
      message: `请输入 ${providerConfig.label} API key`,
      mask: "*",
    });

    const workspace = await input({
      message: "请初始化工作目录路径",
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
