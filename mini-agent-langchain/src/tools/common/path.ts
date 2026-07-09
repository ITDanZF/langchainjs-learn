import path from "node:path";
import { getCustomizeWorkSpace, getDefaultWorkSpace } from "../../workspace/path.ts";

export function getWorkspaceRoot() {
  let configuredWorkspace: string | null = null;

  try {
    configuredWorkspace = getCustomizeWorkSpace();
  } catch {
    configuredWorkspace = null;
  }

  return path.resolve(configuredWorkspace ?? getDefaultWorkSpace());
}

export function resolveWorkspacePath(inputPath?: string) {
  const workspaceRoot = getWorkspaceRoot();
  const requestedPath = inputPath?.trim() || ".";
  const absolutePath = path.isAbsolute(requestedPath)
    ? path.resolve(requestedPath)
    : path.resolve(workspaceRoot, requestedPath);

  const relativePath = path.relative(workspaceRoot, absolutePath);
  if (
    relativePath.startsWith("..") ||
    path.isAbsolute(relativePath) ||
    absolutePath.startsWith("\\\\") ||
    absolutePath.startsWith("//")
  ) {
    throw new Error(
      `Path is outside the agent workspace. Workspace: ${workspaceRoot}`,
    );
  }

  return absolutePath;
}

export function toWorkspaceRelativePath(absolutePath: string) {
  const workspaceRoot = getWorkspaceRoot();
  const relativePath = path.relative(workspaceRoot, absolutePath);
  return relativePath === "" ? "." : relativePath.split(path.sep).join("/");
}
