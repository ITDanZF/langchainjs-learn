import Conversation, { ThreadInfo } from "../Memory/Conversation.ts";

export default class SessionView {
  private readonly cyan = "\x1b[36m";
  private readonly green = "\x1b[32m";
  private readonly yellow = "\x1b[33m";
  private readonly gray = "\x1b[90m";
  private readonly red = "\x1b[31m";
  private readonly reset = "\x1b[0m";
  private readonly bold = "\x1b[1m";

  constructor() {}

  MainRender(conversation: Conversation) {
    this.renderDashboard(conversation);
  }

  clear() {
    console.clear();
  }

  renderDashboard(conversation: Conversation) {
    this.clear();
    this.renderWelcome();
    this.renderStatusLine(conversation);
    this.renderActiveConversation(conversation);
    this.renderConversationList(conversation);
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

  renderStatusLine(conversation: Conversation) {
    const active = conversation.getActiveConversation();
    const count = conversation.getAllConversations().length;
    const title = active?.title ?? "Unknown";
    const id = active?.id ?? "unknown";

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

  renderActiveConversation(conversation: Conversation) {
    const active = conversation.getActiveConversation();

    console.log(`${this.yellow}当前会话：${this.reset}${active?.title ?? "Unknown"}`);
    console.log(`${this.yellow}Thread ID：${this.reset}${active?.id ?? "unknown"}`);
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
    console.log("");
  }

  renderConversationList(conversation: Conversation) {
    const activeThreadId = conversation.getActiveThreadId();
    const conversations = conversation.getAllConversations();

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

  renderConversationItem(thread: ThreadInfo, isActive = false) {
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
    console.log(`${this.gray}/exit${this.reset}                退出`);
    console.log("");
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

  private formatDate(date: Date) {
    return date.toLocaleString("zh-CN", {
      hour12: false,
    });
  }

  private renderMessageDivider() {
    console.log(`${this.gray}──────────────────────────────────────────────${this.reset}`);
  }
}
