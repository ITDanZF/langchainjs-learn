import { Command } from 'commander';
import type { Interface } from 'node:readline/promises';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { PrintSysInfo } from './utils.ts';

type InputHandler = (input: string) => Promise<void> | void;

export default class CLI {
    private program: Command;
    private RL: Interface;

    private readonly name = 'mini-agent';
    private readonly description = 'A mini Agent CLI';
    private readonly version = '0.1.0';

    constructor() {
        this.program = new Command();
        this.RL = createInterface({ input, output });

        // default sys info
        this.program
            .name(this.name)
            .description(this.description)
            .version(this.version);
    }

    /**
     * 系统命令开始运行
     */
    async run(argv: string[], handleInput: InputHandler) {
        try {
            this.RegisterInteractiveCommand(handleInput);

            await this.program.parseAsync(argv);
        } catch (error) {
            this.handleError(error);
            process.exitCode = 1;
        }
    }

    /**
     * 交互式命令行循环体
     */
    async CLILoop(handleInput: InputHandler) {
        try {
            while (true) {
                const line = (await this.RL.question('> ')).trim();

                if (!line) continue;

                const command = line.toLowerCase();

                if (this.isExitCommand(line)) {
                    console.log('已退出 Mini Agent，再见！');
                    break;
                }

                try {
                    await handleInput(line);
                } catch (error) {
                    this.handleError(error);
                }
            }
        } finally {
            this.RL.close();
        }
    }

    /**
     * 注册交互式命令行
     */
    private RegisterInteractiveCommand(handleInput: InputHandler) {
        this.program.action(async () => {
            // 打印系统的初始信息
            PrintSysInfo();

            // 开始系统命令循环
            await this.CLILoop(handleInput);
        });
    }

    /**
     * 推出命令
     */
    private isExitCommand(line: string) {
        const command = line.trim().toLowerCase();

        return (
            command === '/exit' ||
            command === '/quit' ||
            command === 'exit' ||
            command === 'quit' ||
            command === 'q' ||
            command === '退出'
        );
    }

    private handleError(error: unknown) {
        const red = '\x1b[31m';
        const gray = '\x1b[90m';
        const reset = '\x1b[0m';

        if (error instanceof Error) {
            console.error(`${red}运行失败：${reset}${error.message}`);

            if (process.env.NODE_ENV === 'development' && error.stack) {
                console.error(`${gray}${error.stack}${reset}`);
            }

            return;
        }

        console.error(`${red}运行失败：${reset}`, error);
    }
}
