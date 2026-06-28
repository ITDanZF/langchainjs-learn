import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import dotenv from 'dotenv';
import { z } from 'zod';

import { CONFIG_KEYS, type ConfigKey } from '../enum/Config.constant.ts';
import { getAgentHome } from '../workspace/path.ts';

const packageRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    '..'
);

dotenv.config({ path: path.join(packageRoot, '.env') });

type ConfigInfo = Partial<Record<ConfigKey, string>>;

function loadFileConfig(): ConfigInfo {
    const configPath = path.join(getAgentHome(), 'config.json');

    if (!fs.existsSync(configPath)) {
        return {};
    }

    try {
        const content = fs.readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as ConfigInfo;
    } catch {
        return {};
    }
}

function getConfigValue(key: ConfigKey, fileConfig: ConfigInfo) {
    const envValue = process.env[key];

    if (typeof envValue === 'string' && envValue.trim() !== '') {
        return envValue;
    }

    const fileValue = fileConfig[key];

    if (typeof fileValue === 'string' && fileValue.trim() !== '') {
        return fileValue;
    }

    return undefined;
}

const fileConfig = loadFileConfig();

const mergedConfig = {
    [CONFIG_KEYS.MODEL_PROVIDER]: getConfigValue(
        CONFIG_KEYS.MODEL_PROVIDER,
        fileConfig
    ),
    [CONFIG_KEYS.MODEL_NAME]: getConfigValue(CONFIG_KEYS.MODEL_NAME, fileConfig),
    [CONFIG_KEYS.MODEL_BASE_URL]: getConfigValue(
        CONFIG_KEYS.MODEL_BASE_URL,
        fileConfig
    ),
    [CONFIG_KEYS.MODEL_API_KEY]: getConfigValue(
        CONFIG_KEYS.MODEL_API_KEY,
        fileConfig
    ),
    [CONFIG_KEYS.AGENT_WORKSPACE]: getConfigValue(
        CONFIG_KEYS.AGENT_WORKSPACE,
        fileConfig
    ),
    [CONFIG_KEYS.LOG_LEVEL]: getConfigValue(CONFIG_KEYS.LOG_LEVEL, fileConfig),
};

const EnvSchema = z.object({
    MODEL_PROVIDER: z.string().min(1, 'MODEL_PROVIDER is required'),
    MODEL_NAME: z.string().min(1, 'MODEL_NAME is required'),
    MODEL_BASE_URL: z.string().url('MODEL_BASE_URL must be a valid url'),
    MODEL_API_KEY: z.string().min(1, 'MODEL_API_KEY is required'),
    AGENT_WORKSPACE: z.string().default(''),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export const env = EnvSchema.parse(mergedConfig);
