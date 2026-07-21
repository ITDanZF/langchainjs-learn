import path from "node:path";
import { homedir } from "node:os";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import {
  getAgentHome,
  getCustomizeWorkSpace,
  getDefaultWorkSpace,
} from "./path.ts";
export default class WorkSpace {
  constructor() {}

  /**
   * 创建用户目录
   */
  async createHomeRoot() {
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
  async createAgentWorkSpace() {
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
}
