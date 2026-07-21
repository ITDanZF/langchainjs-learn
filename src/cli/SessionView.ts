import type {
  ThreadDto,
  ThreadSnapshot,
} from "../application/threadContracts.ts";
import type {
  SkillDetail,
  SkillDoctorResult,
  SkillSnapshot,
  SkillSummary,
} from "../skills/index.ts";
import type { ThreadSkillState } from "../application/threadPorts.ts";

export default class SessionView {
  private readonly cyan = "\x1b[36m";
  private readonly green = "\x1b[32m";
  private readonly yellow = "\x1b[33m";
  private readonly gray = "\x1b[90m";
  private readonly red = "\x1b[31m";
  private readonly reset = "\x1b[0m";
  private readonly bold = "\x1b[1m";

  constructor() {}

  MainRender(snapshot: ThreadSnapshot) {
    this.renderDashboard(snapshot);
  }

  clear() {
    console.clear();
  }

  renderDashboard(snapshot: ThreadSnapshot) {
    this.clear();
    this.renderWelcome();
    this.renderStatusLine(snapshot);
    this.renderActiveConversation(snapshot);
    this.renderConversationList(snapshot);
    this.renderHelp();
    this.renderPromptHint();
  }

  renderWelcome() {
    const now = new Date().toLocaleString("zh-CN", {
      hour12: false,
    });

    console.log(`
${this.cyan}${this.bold}
__  __ _       _        _                    _
|  \\/  (_)     (_)      / \\   __ _  ___ _ __ | |_
| |\\/| | |_____| |____ / _ \\ / _\` |/ _ \\ '_ \\| __|
| |  | | |_____| |___ / ___ \\ (_| |  __/ | | | |_
|_|  |_|_|     |_|   /_/   \\_\\__, |\\___|_| |_|\\__|
                              |___/
${this.reset}
${this.green}${this.bold}欢迎使用 Mini Agent CLI${this.reset}

${this.gray}──────────────────────────────────────────────${this.reset}
${this.yellow}名称：${this.reset}mini-agent
${this.yellow}版本：${this.reset}0.1.0
${this.yellow}说明：${this.reset}一个基于 LangChain.js 的迷你 Agent 命令行工具
${this.yellow}时间：${this.reset}${now}
${this.gray}──────────────────────────────────────────────${this.reset}
`);
  }

  renderStatusLine(snapshot: ThreadSnapshot) {
    const active = snapshot.activeThread;
    const count = snapshot.threads.length;
    const title = active.title;
    const id = active.id;

    console.log(
      `${this.cyan}状态：${this.reset}已连接当前会话 ${this.bold}${title}${this.reset} ${this.gray}(${id})${this.reset}`,
    );
    console.log(`${this.cyan}会话数：${this.reset}${count}`);
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
    console.log("");
  }

  renderHeader() {
    console.log(`${this.cyan}${this.bold}Mini Agent Session${this.reset}`);
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
  }

  renderActiveConversation(snapshot: ThreadSnapshot) {
    const active = snapshot.activeThread;

    console.log(`${this.yellow}当前会话：${this.reset}${active.title}`);
    console.log(`${this.yellow}Thread ID：${this.reset}${active.id}`);
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
    console.log("");
  }

  renderConversationList(snapshot: ThreadSnapshot) {
    const activeThreadId = snapshot.activeThreadId;
    const conversations = snapshot.threads;

    console.log(`${this.green}${this.bold}会话列表${this.reset}`);

    if (conversations.length === 0) {
      console.log(`${this.gray}暂无会话。${this.reset}`);
      console.log("");
      return;
    }

    for (const item of conversations) {
      this.renderConversationItem(item, item.id === activeThreadId);
    }

    console.log("");
  }

  renderConversationItem(thread: ThreadDto, isActive = false) {
    const marker = isActive ? ">" : " ";
    const title = thread.title || "Untitled";
    const id = thread.id ?? "unknown";
    const updatedAt = this.formatDate(thread.updatedAt);
    const label = isActive ? `${this.green}${this.bold}active${this.reset}` : `${this.gray}idle${this.reset}`;

    console.log(
      `${marker} ${title} ${this.gray}(${id})${this.reset} ${label} ${this.gray}${updatedAt}${this.reset}`,
    );
  }

  renderHelp() {
    console.log(`${this.green}${this.bold}命令${this.reset}`);
    console.log(`${this.gray}/thread${this.reset}              查看当前会话`);
    console.log(`${this.gray}/threads${this.reset}             查看所有会话`);
    console.log(`${this.gray}/thread-new [title]${this.reset}  新建会话并切换`);
    console.log(`${this.gray}/thread-use <id>${this.reset}     切换到已有会话`);
    console.log(`${this.gray}/skills${this.reset}              查看已加载 Skill`);
    console.log(`${this.gray}/skill <id>${this.reset}          查看 Skill 详情`);
    console.log(`${this.gray}/skill-doctor${this.reset}        检查 Skill 加载状态`);
    console.log(`${this.gray}/skill-reload${this.reset}        重新同步并加载 Skill`);
    console.log(`${this.gray}/skill-use <id>${this.reset}      当前会话固定启用 Skill`);
    console.log(`${this.gray}/skill-disable <id>${this.reset}  当前会话禁用自动命中的 Skill`);
    console.log(`${this.gray}/skill-clear${this.reset}         清除当前会话 Skill 设置`);
    console.log(`${this.gray}/skill-template [id]${this.reset} 打印 Skill 模板`);
    console.log(`${this.gray}/skill-new <id>${this.reset}      创建用户 Skill 模板`);
    console.log(`${this.gray}/skill-create [id]${this.reset}   通过模型生成用户 Skill`);
    console.log(`${this.gray}/exit${this.reset}                退出`);
    console.log("");
  }

  renderSkillList(snapshot: SkillSnapshot) {
    console.log(`${this.green}${this.bold}Skill 列表${this.reset}`);

    if (snapshot.skills.length === 0) {
      console.log(`${this.gray}暂无已加载 Skill。${this.reset}`);
      console.log("");
      return;
    }

    for (const skill of snapshot.skills) {
      this.renderSkillItem(skill);
    }

    if (snapshot.issues.length > 0) {
      console.log(`${this.yellow}加载提示：${this.reset}${snapshot.issues.length} 个问题，可运行 /skill-doctor 查看。`);
    }

    console.log("");
  }

  renderSkillDetail(skill: SkillDetail) {
    console.log(`${this.green}${this.bold}${skill.name}${this.reset} ${this.gray}(${skill.id})${this.reset}`);
    console.log(`${this.yellow}版本：${this.reset}${skill.version}`);
    console.log(`${this.yellow}来源：${this.reset}${skill.sourceType}`);
    console.log(`${this.yellow}托管：${this.reset}${skill.managed ? "是" : "否"}`);
    console.log(`${this.yellow}子 Agent：${this.reset}${skill.agentEnabled ? "启用" : "未启用"}`);
    console.log(`${this.yellow}只读：${this.reset}${skill.readOnly === null ? "未声明" : skill.readOnly ? "是" : "否"}`);
    console.log(`${this.yellow}路径：${this.reset}${skill.filePath}`);
    console.log(`${this.yellow}说明：${this.reset}${skill.description}`);

    if (skill.triggers.length > 0) {
      console.log(`${this.yellow}触发词：${this.reset}${skill.triggers.join("、")}`);
    }
    if (skill.tools.length > 0) {
      console.log(`${this.yellow}工具：${this.reset}${skill.tools.join(", ")}`);
    }
    if (skill.agentTools.length > 0) {
      console.log(`${this.yellow}Agent 工具：${this.reset}${skill.agentTools.join(", ")}`);
    }

    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
    console.log(skill.body);
    console.log("");
  }

  renderSkillDoctor(result: SkillDoctorResult) {
    const status = result.ok
      ? `${this.green}通过${this.reset}`
      : `${this.yellow}存在问题${this.reset}`;

    console.log(`${this.green}${this.bold}Skill Doctor${this.reset}`);
    console.log(`${this.yellow}状态：${this.reset}${status}`);
    console.log(`${this.yellow}Skill 数量：${this.reset}${result.skillCount}`);
    console.log(`${this.yellow}问题数量：${this.reset}${result.issueCount}`);
    console.log(`${this.yellow}加载时间：${this.reset}${this.formatDate(result.loadedAt)}`);

    if (result.issues.length > 0) {
      console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
      for (const issue of result.issues) {
        console.log(`${this.red}- [${issue.sourceType}] ${issue.root}${this.reset}`);
        console.log(`  ${issue.message}`);
      }
    }

    console.log("");
  }

  renderThreadSkillState(state: ThreadSkillState) {
    const active = state.activeSkillIds.length > 0
      ? state.activeSkillIds.join(", ")
      : "none";
    const disabled = state.disabledSkillIds.length > 0
      ? state.disabledSkillIds.join(", ")
      : "none";

    console.log(`${this.green}${this.bold}当前会话 Skill 设置${this.reset}`);
    console.log(`${this.yellow}固定启用：${this.reset}${active}`);
    console.log(`${this.yellow}禁用自动触发：${this.reset}${disabled}`);
    console.log("");
  }

  renderSkillTemplate(template: string) {
    console.log(`${this.green}${this.bold}SKILL.md 模板${this.reset}`);
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
    console.log(template);
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
    console.log("");
  }

  private renderSkillItem(skill: SkillSummary) {
    const source = skill.sourceType;
    const agent = skill.agentEnabled ? "agent" : "prompt";
    const managed = skill.managed ? "managed" : "custom";

    console.log(
      `- ${this.bold}${skill.id}${this.reset} ${this.gray}v${skill.version} ${source} ${agent} ${managed}${this.reset}`,
    );
    console.log(`  ${skill.description}`);
  }

  renderPromptHint() {
    console.log(`${this.gray}直接输入问题开始对话。${this.reset}`);
    console.log("");
  }

  renderUserMessage(content: string) {
    this.renderMessageDivider();
    console.log(`${this.yellow}你：${this.reset}${content}`);
  }

  renderThinking() {
    console.log(`${this.gray}AI 正在思考，请稍候...${this.reset}`);
  }

  renderAgentResult(result: { messages?: Array<{ content?: unknown }> }) {
    const lastMessage = result.messages?.at(-1);
    this.renderAssistantMessage(lastMessage?.content);
  }

  renderAssistantMessage(content: unknown) {
    if (typeof content === "string") {
      console.log(`${this.green}AI：${this.reset}${content}`);
      console.log("");
      return;
    }

    console.log(`${this.green}AI：${this.reset}`, content ?? "");
    console.log("");
  }

  renderSystemMessage(content: string) {
    console.log(`${this.gray}${content}${this.reset}`);
  }

  renderError(error: unknown) {
    if (error instanceof Error) {
      console.error(`${this.red}运行失败：${this.reset}${error.message}`);
      return;
    }

    console.error(`${this.red}运行失败：${this.reset}`, error);
  }

  private formatDate(date: string) {
    return new Date(date).toLocaleString("zh-CN", {
      hour12: false,
    });
  }

  private renderMessageDivider() {
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
  }
}
