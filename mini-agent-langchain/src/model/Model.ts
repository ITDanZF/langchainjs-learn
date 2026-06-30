import { ChatOpenAI } from "@langchain/openai";
import { BaseMessageLike } from "@langchain/core/messages";
import { CONFIG_KEYS } from "../enum/Config.constant.ts";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { baseSystemPrompt } from "./prompts/system.ts";

export default class Model {
  // 当前模型对象
  private CurrentModel: ChatOpenAI;

  // 当前agent的模板对象
  private PromptTemplate: ChatPromptTemplate;

  constructor() {
    this.CurrentModel = new ChatOpenAI({
      model: process.env[CONFIG_KEYS.MODEL_NAME],
      apiKey: process.env[CONFIG_KEYS.MODEL_API_KEY],
      configuration: {
        baseURL: process.env[CONFIG_KEYS.MODEL_BASE_URL],
      },
    });

    this.PromptTemplate = ChatPromptTemplate.fromMessages([
      ["system", baseSystemPrompt],
      ["human", "{input}"],
    ]);
  }

  getChain() {
    return this.PromptTemplate.pipe(this.CurrentModel);
  }

  invoke(input: BaseMessageLike) {
    return this.getChain().invoke({ input });
  }

  stream(input: BaseMessageLike) {
    return this.getChain().stream({ input });
  }
}
