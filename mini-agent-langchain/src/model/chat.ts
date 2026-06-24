import { ChatOpenAI } from "@langchain/openai";
import { env } from "../config/index.ts";

export function createChatModel() {
  return new ChatOpenAI({
    model: env.DEEPSEEK_MODEL,
    apiKey: env.DEEPSEEK_API_KEY,
    configuration: {
      baseURL: env.DEEPSEEK_BASE_URL,
    },
  });
}
