import { describe, expect, it, vi } from "vitest";
import { defineAgent } from "../../src/Agent/AgentDefinition.ts";
import AgentRegistry from "../../src/Agent/AgentRegistry.ts";
import AgentRuntime from "../../src/Agent/AgentRuntime.ts";
import ToolResolver from "../../src/tools/ToolResolver.ts";

describe("AgentRuntime", () => {
  it("passes the agent maxTurns setting to the model", async () => {
    const registry = new AgentRegistry([
      defineAgent({
        id: "test-agent",
        name: "Test Agent",
        description: "Test",
        systemPrompt: "Test prompt",
        tools: [],
        maxTurns: 3,
      }),
    ]);
    const stream = vi.fn(async function* () {
      yield "done";
    });
    const runtime = new AgentRuntime(
      registry,
      { stream },
      new ToolResolver([]),
    );

    const result = await runtime.run({
      agentType: "test-agent",
      prompt: "work",
      parentThreadId: "thread-1",
    });

    expect(result.status).toBe("completed");
    expect(stream).toHaveBeenCalledWith(
      expect.objectContaining({ maxTurns: 3 }),
    );
  });
});
