import { ChatOpenAI } from "@langchain/openai";
import { config } from "../config/index.ts";

export function createChatModel() {
  return new ChatOpenAI({
    model: config.DEEPSEEK_MODEL,
    apiKey: config.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: config.DEEPSEEK_BASE_URL,
    },
  });
}
