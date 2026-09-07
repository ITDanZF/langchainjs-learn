/**
 * 流式打印
 */
export async function PrintStream(stream: AsyncIterable<unknown>) {
    for await (const chunk of stream) {
        if (
            typeof chunk === 'object' &&
            chunk !== null &&
            'content' in chunk &&
            typeof chunk.content === 'string'
        ) {
            process.stdout.write(chunk.content);
        }
    }
    process.stdout.write('\n');
}
