import { BaseMessage, HumanMessage } from '../message/type';
import { config } from '../config';
import { DeepSeekStream } from './generators/AiModel';

/**
 * DeepSeek api请求
 */
export async function DeepSeek(newMsg: BaseMessage[]) {
    let aiMsg = '';
    for await (const chunk of DeepSeekStream(newMsg)) {
        process.stdout.write(chunk);
        aiMsg += chunk;
    }
    process.stdout.write('\n');
    return aiMsg;
}
