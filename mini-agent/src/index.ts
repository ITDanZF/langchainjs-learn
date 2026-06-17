import { config } from './config';
import type { ChatMessage } from './types';
import { DeepSeek } from './service/index';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const input = process.argv.slice(2).join(' ').trim();

/**
 * 添加消息到消息列表
 */
function addMsg(msg: ChatMessage) {
    messages.push(msg);
}

// 缓存历史消息
const messages: ChatMessage[] = [
    {
        role: 'system',
        content: '你是一个命令行agent!',
    },
];

if (!input) {
    console.error('请输入要执行的命令');
    process.exit(1);
}

// 用户Msg
const HumanMessage: ChatMessage = {
    role: 'user',
    content: input,
};

// 添加用户输入的消息 到历史缓存
addMsg(HumanMessage);

const aiMsg = await DeepSeek(messages);

// ai Msg
const AiMessage: ChatMessage = {
    role: 'assistant',
    content: aiMsg,
};
addMsg(AiMessage);

console.log('当前消息列表：', messages);

//  创建第一个readline接口实例
const rl = readline.createInterface({ input, output });

async function main() {}

main();
