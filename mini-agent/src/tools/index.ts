import { z } from 'zod';
import Tools from './Tools';

const tools = new Tools();

/**
 *  示例工具：echo
 */
tools.registerTool({
    name: 'echo',
    description: 'Echoes the input back to the caller.',
    permission: 'execute_safe',
    schema: z.object({
        message: z.string().describe('The message to echo back.'),
    }),
    execute: async (input: any) => {
        return `Echo: ${input.message}`;
    },
});

export default tools;
