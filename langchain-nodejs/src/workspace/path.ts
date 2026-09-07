import path from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";

/**
 *  获取当前工作目录
 */
export function workSpaceRoot() {
  return path.join(homedir(), "workSpaceRoot");
}

/**
 * 获取当前的计算机的用户目录
 */
export function getAgentHome() {
  const override = process.env.MINI_AGENT_HOME?.trim();
  if (override) {
    return path.resolve(override);
  }

  return path.join(homedir(), ".mini-agent");
}

/**
 * 获取当前的用户目录下的工作目录路径(默认)
 */
export function getDefaultWorkSpace() {
  return path.join(getAgentHome(), "workSpaceRoot");
}

/**
 * 获取自定义工作目录
 */
export function getCustomizeWorkSpace() {
  const configPath = path.join(getAgentHome(), "config.json");
  const config = JSON.parse(readFileSync(configPath, "utf-8")) as {
    AGENT_WORKSPACE?: string;
  };
  const customizeWorkSpace = config.AGENT_WORKSPACE?.trim();

  if (!customizeWorkSpace) {
    return null;
  }

  return path.isAbsolute(customizeWorkSpace)
    ? path.normalize(customizeWorkSpace)
    : path.join(homedir(), customizeWorkSpace);
}
