import path from "node:path";
import { env } from "../../config/index.js";
import { homedir } from "node:os";

/**
 * 获取工作区域的绝对路径
 */
export const workSpaceRoot = path.resolve(env.AGENT_WORKSPACE);

/**
 * 获取当前的计算机的用户目录
 */
export function getAgentHome() {
  return env.MINI_AGENT_HOME || path.join(homedir(), ".mini-agent");
}

export function createHomeRoot() {}

export function createAgentWorkSpace() {}
