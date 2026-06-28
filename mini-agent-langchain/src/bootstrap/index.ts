import { createAgentWorkSpace, createHomeRoot } from '../workspace/path.ts';
import { select, password, input } from '@inquirer/prompts';
import {
    MODEL_PROVIDER_OPTIONS,
    ModelProvider,
} from '../enum/ModelProvider.constant.ts';

type InfoType = {
    MODEL_PROVIDER?: string;
    MODEL_NAME?: string;
    MODEL_BASE_URL?: string;
    MODEL_API_KEY?: string;
    AGENT_WORKSPACE?: string;
};

export default class Bootstrap {
    private BaseProjectInfo: InfoType;
    constructor() {
        this.BaseProjectInfo = {};
    }

    async setup() {
        await this.initDir();

        await this.initBaseInfo();
    }

    /**
     * 初始化用户目录 和 工作目录
     */
    async initDir() {
        await createHomeRoot();
        await createAgentWorkSpace();
    }

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

        console.log(this.BaseProjectInfo, 'xxxxxx');
    }
}
