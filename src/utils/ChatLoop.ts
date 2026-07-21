import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
type ChatLoopOptions = {
    handleInput: (input: string) => Promise<void> | void;
};

export default async function ChatLoop(options: ChatLoopOptions) {
    const rl = createInterface({ input, output });
    console.log('chatAgent interactive session');
    console.log('输入 /exit 退出。\n');

    try {
        while (true) {
            const line = (await rl.question('> ')).trim();

            if (!line) continue;
            if (line === '/exit' || line === '/quit') break;

            await options.handleInput(line);
        }
    } finally {
        rl.close();
    }
}
