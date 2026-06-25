import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..'
);

dotenv.config({ path: path.join(packageRoot, '.env') });

const EnvSchema = z.object({
    DEEPSEEK_API_KEY: z.string().min(1, 'DEEPSEEK_API_KEY is required'),
    DEEPSEEK_MODEL: z.string().default('deepseek-chat'),
    DEEPSEEK_BASE_URL: z.string().url().default('https://api.deepseek.com'),
    AGENT_WORKSPACE: z.string().default(''),
    MINI_AGENT_HOME: z.string().default('.'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = EnvSchema.parse(process.env);
