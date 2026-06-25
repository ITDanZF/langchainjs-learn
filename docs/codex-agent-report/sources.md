# 来源与证据

## 官方文档

- Codex customization：`https://developers.openai.com/codex/concepts/customization`
- Codex skills：`https://developers.openai.com/codex/skills`
- Codex plugin build / plugin structure：`https://developers.openai.com/codex/plugins/build`
- Codex advanced config：`https://developers.openai.com/codex/config-advanced`
- Codex sandboxing：`https://developers.openai.com/codex/concepts/sandboxing`
- Codex subagents：`https://developers.openai.com/codex/concepts/subagents`
- Codex memories：`https://developers.openai.com/codex/memories`
- OpenAI conversation state：`https://platform.openai.com/docs/guides/conversation-state`
- OpenAI compaction：`https://platform.openai.com/docs/guides/compaction`

## 本地证据

- `C:\Users\Administrator\.codex\config.toml`
- `C:\Users\Administrator\.codex\history.jsonl`
- `C:\Users\Administrator\.codex\session_index.jsonl`
- `C:\Users\Administrator\.codex\logs_2.sqlite`
- `C:\Users\Administrator\.codex\state_5.sqlite`
- `C:\Users\Administrator\.codex\memories_1.sqlite`
- `C:\Users\Administrator\.codex\skills\`
- `C:\Users\Administrator\.codex\plugins\cache\openai-bundled\browser\26.616.81150\.codex-plugin\plugin.json`
- `C:\Users\Administrator\.codex\plugins\cache\openai-bundled\chrome\26.616.81150\.codex-plugin\plugin.json`

## 限制

- Codex manual helper 请求 `https://developers.openai.com/codex/codex-manual.md` 时返回 HTTP 403，未能生成本地 manual/outline。
- 未读取本地 `auth.json`、sqlite 内容、浏览器私有数据或任何 secret。
- 对内部闭源实现仅做工程推断，已尽量用“推断”表述，避免当成官方事实。