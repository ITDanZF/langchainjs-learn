import MessageCache from "./MessageCache";
import { AIMessage } from "./type";

const messageCache = new MessageCache();

/**
 * 定义用户信息
 */
export function HumanMessage(content: string) {
  messageCache.addUserMsg(content);
  return messageCache.getMsgCache();
}

/**
 * 定义ai信息
 */
export function AIMessage(content: string) {
  messageCache.addAIMsg(content);
  return messageCache.getMsgCache();
}
