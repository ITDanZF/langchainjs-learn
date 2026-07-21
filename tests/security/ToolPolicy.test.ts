import { describe, expect, it } from "vitest";
import ToolPolicy from "../../src/security/ToolPolicy.ts";

describe("ToolPolicy", () => {
  it("uses safe defaults and denies unknown tools", () => {
    const policy = new ToolPolicy();

    expect(policy.getPermission("read_file")).toBe("allow");
    expect(policy.getPermission("write_file")).toBe("ask");
    expect(policy.getPermission("unknown_tool")).toBe("deny");
  });

  it("remembers an allowed tool for the current session", () => {
    const policy = new ToolPolicy({ write_file: "ask" });

    policy.allowForSession("write_file");

    expect(policy.getPermission("write_file")).toBe("allow");
  });
});
