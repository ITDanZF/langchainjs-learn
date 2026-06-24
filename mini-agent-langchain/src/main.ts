#!/usr/bin/env node

import { Command } from 'commander';
import { ask, streamAsk } from './model/AskChain.js';
import ChatLoop from './utils/ChatLoop.js';
import { PrintStream } from './utils/Print.js';
async function main() {
    const program = new Command();

    program.name('mini-agent');
    program.description(
        'A mini Agent CLI built step by step with LangChain.js'
    );
    program.version('0.1.0');

    program.action(async () => {
        await ChatLoop({
            handleInput: async (input: string) => {
                const stream = await streamAsk(input);
                await PrintStream(stream);
            },
        });
    });
    await program.parseAsync(process.argv);
}

main();
