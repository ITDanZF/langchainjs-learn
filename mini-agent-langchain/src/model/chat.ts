import { ChatOpenAI } from '@langchain/openai';
import { env } from '../config/index.ts';

export function createChatModel() {
    return new ChatOpenAI({
        model: env.MODEL_NAME,
        apiKey: env.MODEL_API_KEY,
        configuration: {
            baseURL: env.MODEL_BASE_URL,
        },
    });
}
