import { z } from 'zod';
export type ToolPermission =
    | 'read'
    | 'write'
    | 'execute_safe'
    | 'execute_risky';

/**
 * name：模型调用时使用的名称。
 * description：给模型看的说明。
 * permission：权限等级。
 * schema：参数校验
 * execute：真实执行逻辑。
 */
export type ToolDefinition<Input = unknown, output = unknown> = {
    name: string;
    description: string;
    permission: ToolPermission;
    schema: z.ZodType<Input>;
    execute: (input: Input) => Promise<output>;
};
