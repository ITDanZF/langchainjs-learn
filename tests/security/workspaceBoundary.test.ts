import {
  mkdtemp,
  mkdir,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const workspaceState = vi.hoisted(() => ({ path: "" }));

vi.mock("../../src/workspace/path.ts", () => ({
  getCustomizeWorkSpace: () => workspaceState.path,
  getDefaultWorkSpace: () => workspaceState.path,
}));

import {
  assertSafeWorkspaceWritePath,
  resolveExistingWorkspacePath,
  resolveWorkspacePath,
} from "../../src/tools/common/path.ts";
import { atomicWriteTextFile } from "../../src/tools/common/atomicWrite.ts";

let testRoot = "";
let workspace = "";

beforeEach(async () => {
  testRoot = await mkdtemp(path.join(tmpdir(), "mini-agent-security-"));
  workspace = path.join(testRoot, "workspace");
  await mkdir(workspace);
  workspaceState.path = workspace;
});

afterEach(async () => {
  await rm(testRoot, { recursive: true, force: true });
});

describe("workspace boundary", () => {
  it("rejects lexical traversal outside the workspace", () => {
    expect(() => resolveWorkspacePath("../outside.txt")).toThrow(
      "outside the agent workspace",
    );
  });

  it("resolves normal files and writes them atomically", async () => {
    const filePath = path.join(workspace, "nested", "file.txt");
    await atomicWriteTextFile(filePath, "safe");
    await atomicWriteTextFile(filePath, "updated");

    await expect(resolveExistingWorkspacePath(filePath)).resolves.toBe(
      await import("node:fs/promises").then(({ realpath }) => realpath(filePath)),
    );
    await expect(readFile(filePath, "utf8")).resolves.toBe("updated");
  });

  it("rejects reads and writes through a link to outside the workspace", async () => {
    const outside = path.join(testRoot, "outside");
    const link = path.join(workspace, "escape");
    await mkdir(outside);
    await writeFile(path.join(outside, "secret.txt"), "secret");
    await symlink(outside, link, process.platform === "win32" ? "junction" : "dir");

    await expect(
      resolveExistingWorkspacePath(path.join(link, "secret.txt")),
    ).rejects.toThrow("outside the agent workspace");
    await expect(
      assertSafeWorkspaceWritePath(path.join(link, "new.txt")),
    ).rejects.toThrow(/Symbolic links|outside the agent workspace/);
  });
});
