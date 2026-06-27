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

/**
 * 创建用户目录
 */
export async function createHomeRoot() {
  const agentHome = getAgentHome();
  const configPath = path.join(agentHome, "config.json");

  await mkdir(agentHome, { recursive: true });
  await mkdir(path.join(agentHome, "logs"), { recursive: true });
  await mkdir(path.join(agentHome, "sessions"), { recursive: true });

  if (!existsSync(configPath)) {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          MODEL_PROVIDER: "",
          MODEL_NAME: "",
          MODEL_BASE_URL: "",
          MODEL_API_KEY: "",
          AGENT_WORKSPACE: "",
          LOG_LEVEL: "info",
        },
        null,
        2,
      ),
      "utf-8",
    );
    return {
      agentHome,
      configPath,
    };
  }
}

/**
 * 创建工作目录
 */
export async function createAgentWorkSpace() {
  let workSpacePath: string | null = "";
  workSpacePath = getCustomizeWorkSpace();
  if (!workSpacePath) {
    workSpacePath = getDefaultWorkSpace();
  }

  // 创建目录
  if (!existsSync(workSpacePath)) {
    await mkdir(workSpacePath, { recursive: true });
  }

  return workSpacePath;
}
