import { ChatPromptTemplate } from '@langchain/core/prompts';
import { baseSystemPrompt } from './prompts/system.js';
import { createChatModel } from './chat.js';

const prompt = ChatPromptTemplate.fromMessages([
    ['system', baseSystemPrompt],
    ['human', '{input}'],
]);

export function createAskChain() {
    return prompt.pipe(createChatModel());
}

export async function ask(input: string) {
    return createAskChain().invoke({ input });
}

export async function streamAsk(input: string) {
    return createAskChain().stream({ input });
}
