export type Role = "system" | "user" | "assistant" | "tool";

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string | object;
  };
}

// TokenUsage: LLM 调用的 token 消耗
interface TokenUsage {
  prompt_tokens: number; // 输入 token 数
  completion_tokens: number; // 输出 token 数
  total_tokens: number; // 总数
}

// ContentPart: 支持多模态内容
interface TextContentPart {
  type: "text";
  text: string;
}
interface ImageContentPart {
  type: "image_url";
  image_url: {
    url: string; // 图片 URL 或 base64 data URL
    detail?: "low" | "high" | "auto";
  };
}
interface FileContentPart {
  type: "file";
  file: {
    name: string;
    mimeType: string;
    data: string; // base64 编码
  };
}
type ContentPart = TextContentPart | ImageContentPart | FileContentPart;

/**
 * 基本信息数据类型
 */
export interface BaseMessage {
  id: string;
  role: Role;
  content: string | ContentPart[]; // 支持文本或多模态内容
  name?: string; // 可选，工具调用时使用
  createAt?: number;
  metadata?: Record<string, any>;
  usage?: TokenUsage;
}

/**
 * AIMessage: 模型生成的消息，包含可选的工具调用信息
 */
export interface AIMessage extends BaseMessage {
  role: "assistant";
  tool_calls?: ToolCall[];
}

export interface ToolMessage extends BaseMessage {
  role: "tool";
  tool_call_id: string;
}

export interface HumanMessage extends BaseMessage {
  role: "user";
}

export interface SystemMessage extends BaseMessage {
  role: "system";
}
