import { ToolDefinition } from './types';
export default class Tools {
    private tools: Map<string, ToolDefinition> = new Map();

    /**
     * 注册工具   * @param tool 工具定义
     */
    registerTool(tool: ToolDefinition) {
        if (this.tools.has(tool.name)) {
            throw new Error(
                `Tool with name '${tool.name}' is already registered.`
            );
        }
        this.tools.set(tool.name, tool);
    }

    /**
     * 注册工具   * @param tool 工具定义
     */
    getTool(name: string): ToolDefinition {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool with name '${name}' is not registered.`);
        }
        return tool;
    }

    /**
     * 列出所有注册的工具
     */
    listTools(): ToolDefinition[] {
        return Array.from(this.tools.values());
    }

    /**
     * 执行工具函数
     */
    async executeTool(name: string, input: unknown): Promise<unknown> {
        const tool = this.getTool(name);
        const parsed = tool.schema.parse(input);
        return tool.execute(parsed);
    }
}
