import { ChatMessage } from "../types";
import { config } from "../config";

// DeepSeek API 请求函数
export async function DeepSeek(messages: ChatMessage[]) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}
