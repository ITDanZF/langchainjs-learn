/**
 * 打印系统信息
 */
export function PrintSysInfo() {
    const cyan = '\x1b[36m';
    const green = '\x1b[32m';
    const yellow = '\x1b[33m';
    const gray = '\x1b[90m';
    const reset = '\x1b[0m';
    const bold = '\x1b[1m';

    const now = new Date().toLocaleString('zh-CN', {
        hour12: false,
    });

    console.log(`
            ${cyan}${bold}
            __  __ _       _        _                    _   
            |  \\/  (_)     (_)      / \\   __ _  ___ _ __ | |_ 
            | |\\/| | |_____| |____ / _ \\ / _\` |/ _ \\ '_ \\| __|
            | |  | | |_____| |___ / ___ \\ (_| |  __/ | | | |_ 
            |_|  |_|_|     |_|   /_/   \\_\\__, |\\___|_| |_|\\__|
                                        |___/                
            ${reset}
            ${green}${bold}欢迎使用 Mini Agent CLI${reset}

            ${gray}──────────────────────────────────────────────${reset}
            ${yellow}名称：${reset}mini-agent
            ${yellow}版本：${reset}0.1.0
            ${yellow}说明：${reset}一个基于 LangChain.js 的迷你 Agent 命令行工具
            ${yellow}时间：${reset}${now}
            ${gray}──────────────────────────────────────────────${reset}

            ${green}你可以直接输入问题开始对话。${reset}
            ${gray}输入 Ctrl+C 可退出程序。${reset}
    `);
}
