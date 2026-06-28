import {
    createAgentWorkSpace,
    createHomeRoot,
    getAgentHome,
} from '../workspace/path.ts';
import { select, password, input } from '@inquirer/prompts';
import {
    MODEL_PROVIDER_OPTIONS,
    ModelProvider,
} from '../enum/ModelProvider.constant.ts';
import { ConfigKey, REQUIRED_CONFIG_KEYS } from '../enum/Config.constant.ts';
import path from 'node:path';
import fs from 'node:fs';

type InfoType = Partial<Record<ConfigKey, string>>;

export default class Bootstrap {
    private BaseProjectInfo: InfoType;
    constructor() {
        this.BaseProjectInfo = {};
    }

    /**
     * 初始化
     */
    async setup() {
        await this.initDir();

        const configInfo = this.loadConfig();

        if (configInfo) {
            this.BaseProjectInfo = configInfo;
            return;
        }

        await this.initBaseInfo();
    }

    /**
     * 初始化用户目录 和 工作目录
     */
    async initDir() {
        await createHomeRoot();
        await createAgentWorkSpace();
    }

    /**
     * 初始化信息
     */
    async initBaseInfo() {
        const options = Object.entries(MODEL_PROVIDER_OPTIONS).map(
            ([value, item]) => ({
                name: `${item.label} (${item.defaultModel})`,
                value: value as ModelProvider,
                description: item.baseURL,
            })
        );

        const provide: ModelProvider = await select({
            message: '请选择一个模型提供商：',
            choices: options,
        });

        const providerConfig = MODEL_PROVIDER_OPTIONS[provide];

        const apiKey = await password({
            message: `请输入 ${providerConfig.label} API key`,
            mask: '*',
        });

        const workspace = await input({
            message: '请初始化工作目录路径',
            default: '',
        });

        this.BaseProjectInfo = {
            MODEL_PROVIDER: provide,
            MODEL_NAME: providerConfig.defaultModel,
            MODEL_BASE_URL: providerConfig.baseURL,
            MODEL_API_KEY: apiKey,
            AGENT_WORKSPACE: workspace,
        };

        this.saveConfig(this.BaseProjectInfo);
    }

    /**
     * 加载配置信息
     */
    loadConfig(): InfoType | null {
        const userHomePath = getAgentHome();
        const configPath = path.join(userHomePath, 'config.json');
        if (!fs.existsSync(configPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            const config = JSON.parse(content) as InfoType;

            if (
                !config.MODEL_PROVIDER ||
                !config.MODEL_NAME ||
                !config.MODEL_BASE_URL ||
                !config.MODEL_API_KEY
            ) {
                return null;
            }

            Object.entries(config).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    process.env[key] = String(value);
                }
            });

            return config;
        } catch (error) {
            return null;
        }
    }

    /**
     * 保存配置信息
     */
    saveConfig(config: InfoType) {
        const userHomePath = getAgentHome();
        const configPath = path.join(userHomePath, 'config.json');

        if (!fs.existsSync(configPath)) {
            throw new Error(`该用户目录 ${configPath}不存在`);
        }

        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        Object.entries(config).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                process.env[key] = String(value);
            }
        });
    }

    /**
     * 配置文件校验信息
     */
    checkConfigInfo(config: InfoType) {
        const missingKeys = REQUIRED_CONFIG_KEYS.filter((key) => {
            const value = config[key];
            return typeof value !== 'string' || value.trim() === '';
        });

        if (missingKeys.length > 0) {
            console.error(
                `配置文件校验失败，缺少必要字段：${missingKeys.join(', ')}`
            );
            process.exit(1);
        }

        console.log('配置文件校验成功');
    }
}
