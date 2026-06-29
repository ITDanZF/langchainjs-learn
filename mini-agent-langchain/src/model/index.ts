import { ChatOpenAI } from "@langchain/openai";
import { InfoType } from "../config/index.ts";
import { CONFIG_KEYS } from "../enum/Config.constant.ts";
export default class AgentModel {
  constructor() {}

  createChatModel() {
    return new ChatOpenAI({
      model: process.env[CONFIG_KEYS.MODEL_NAME],
      apiKey: process.env[CONFIG_KEYS.MODEL_API_KEY],
      configuration: {
        baseURL: process.env[CONFIG_KEYS.MODEL_BASE_URL],
      },
    });
  }
}
