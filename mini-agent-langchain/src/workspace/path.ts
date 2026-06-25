import path from 'node:path';
import { env } from '../config/index.js';
import { homedir } from 'node:os';
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 *  获取当前工作目录
 */
export function workSpaceRoot() {
    return path.join(homedir(), 'workSpaceRoot');
}

/**
 * 获取当前的计算机的用户目录
 */
export function getAgentHome() {
    return path.join(homedir(), '.mini-agent');
}

/**
 * 创建用户目录
 */
export async function createHomeRoot() {
    const agentHome = getAgentHome();
    const configPath = path.join(agentHome, 'config.json');

    await mkdir(agentHome, { recursive: true });
    await mkdir(path.join(agentHome, 'logs'), { recursive: true });
    await mkdir(path.join(agentHome, 'sessions'), { recursive: true });

    if (!existsSync(configPath)) {
        await writeFile(
            configPath,
            JSON.stringify(
                {
                    MODEL_PROVIDER: '',
                    MODEL_NAME: '',
                    MODEL_BASE_URL: '',
                    MODEL_API_KEY: '',
                    AGENT_WORKSPACE: '',
                    LOG_LEVEL: 'info',
                },
                null,
                2
            ),
            'utf-8'
        );
        return {
            agentHome,
            configPath,
        };
    }
}

export async function createAgentWorkSpace() {
    const agentHome = getAgentHome();
    const configPath = path.join(agentHome, 'config.json');
    const defaultWorkSpace = path.join(homedir(), 'workSpaceRoot');
}
