import { ChatMessage } from "../types";
import { config } from "../config";

// DeepSeek API 请求函数
export async function DeepSeek(
  messages: ChatMessage[],
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: config.DEEPSEEK_MODEL,
      messages,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`DeepSeek 请求失败：${response.status} ${errorText}`);
  }

  // 开始流式读取
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Failed to get response reader");
  }

  let fullContent = "";
  const decoder = new TextDecoder("utf-8");

  // 循环读取流式数据
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    const chunk = decoder.decode(value, { stream: true });
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) {
        continue;
      }
      const jsonStr = trimmed.slice(5).trim();
      if (jsonStr === "[DONE]") {
        break;
      }
      try {
        const data = JSON.parse(jsonStr);
        const content = data.choices?.[0]?.delta?.content;
        if (content) {
          fullContent += content;
          onChunk?.(content);
        }
      } catch (error) {}
    }
  }

  return fullContent;
}
