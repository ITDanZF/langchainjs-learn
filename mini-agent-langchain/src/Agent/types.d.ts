/**
 * 描述一个系统内置 Agent 的静态能力。
 *
 * AgentDefinition 只负责声明 Agent 是什么，
 * 不包含某次运行的状态、消息和任务信息。
 */
export interface AgentDefinitionOptions {
  /**
   * Agent 的唯一调用名称。
   *
   * 例如：explore、planner、reviewer。
   * 调用子 Agent 时对应 subagent_type。
   */
  readonly agentType: string;

  /**
   * 描述什么时候应该使用该 Agent。
   *
   * 这段内容会提供给主 Agent，
   * 帮助主 Agent 判断是否需要调用它。
   */
  readonly whenToUse: string;

  /**
   * 返回子 Agent 使用的 System Prompt。
   *
   * 使用函数而不是字符串，是为了以后可以根据
   * 工作目录、运行模式等上下文动态生成 Prompt。
   */
  readonly getSystemPrompt: () => string;
}
