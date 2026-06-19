import { BaseMessage } from '../../message/type';
import { config } from '../../config';
export async function* DeepSeekStream(
    messages: BaseMessage[],
    signal?: AbortSignal
): AsyncGenerator<string, string> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
            model: config.DEEPSEEK_MODEL,
            messages,
            stream: true,
        }),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepSeek 请求失败：${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Failed to get response reader');
    }

    let fullContent = '';
    const decoder = new TextDecoder('utf-8');

    while (true) {
        const { done, value } = await reader.read();
        if (done) {
            break;
        }

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;

            const jsonStr = trimmed.slice(5).trim();
            if (jsonStr === '[DONE]') break;

            try {
                const data = JSON.parse(jsonStr);
                const content = data.choices?.[0]?.delta?.content;
                if (content) {
                    fullContent += content;
                    yield content;
                }
            } catch (error) {
                if (jsonStr !== '') {
                    console.error('SSE 解析失败:', jsonStr, error);
                }
            }
        }
    }

    return fullContent;
}
