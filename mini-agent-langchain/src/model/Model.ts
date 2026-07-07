import { ChatOpenAI } from "@langchain/openai";
import { BaseMessageLike } from "@langchain/core/messages";
import { CONFIG_KEYS } from "../enum/Config.constant.ts";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { baseSystemPrompt } from "./prompts/system.ts";
import Memory from "../Memory/index.ts";
import { createAgent, HumanMessage, SystemMessage } from "langchain";
import { threadId } from "node:worker_threads";

export default class Model {
  // 当前模型对象
  private CurrentModel: ChatOpenAI;

  private CurrentMemory;

  private CurrentAgent;

  // 当前agent的模板对象
  private PromptTemplate: ChatPromptTemplate;

  constructor() {
    this.CurrentMemory = new Memory({
      LocalStore: "sqlite",
    });

    this.CurrentModel = new ChatOpenAI({
      model: process.env[CONFIG_KEYS.MODEL_NAME],
      apiKey: process.env[CONFIG_KEYS.MODEL_API_KEY],
      configuration: {
        baseURL: process.env[CONFIG_KEYS.MODEL_BASE_URL],
      },
    });

    this.CurrentAgent = createAgent({
      model: this.CurrentModel,
      tools: [],
      // systemPrompt: new SystemMessage(baseSystemPrompt),
      checkpointer: this.CurrentMemory.getCheckoutPointer(),
    });

    this.PromptTemplate = ChatPromptTemplate.fromMessages([
      ["system", baseSystemPrompt],
      ["human", "{input}"],
    ]);
  }

  invoke(input: string, threadId: string = "default") {
    return this.CurrentAgent.invoke(
      {
        messages: [new HumanMessage(input)],
      },
      this.CurrentMemory.getConfig(threadId),
    );
  }
}
