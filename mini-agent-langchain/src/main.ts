#!/usr/bin/env node
import { ask, streamAsk } from './model/AskChain.js';
import { PrintStream } from './utils/Print.js';
import { createAgentWorkSpace, createHomeRoot } from './workspace/path.js';
import CLI from './cli/index.js';

async function main() {
    // 创建工作目录
    await createHomeRoot();
    const workSpacePath = await createAgentWorkSpace();

    const cli = new CLI();

    await cli.run(process.argv, async (input: string) => {
        const stream = await streamAsk(input);
        await PrintStream(stream);
    });
}

main().catch((error) => {
    console.error('程序启动失败：', error);
    process.exitCode = 1;
});
