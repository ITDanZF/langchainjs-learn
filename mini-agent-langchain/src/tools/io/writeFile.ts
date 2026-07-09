import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { tool } from "langchain";
import { z } from "zod";
import { assertFileFreshForWrite, updateReadFileState } from "../common/fileState.ts";
import { resolveWorkspacePath, toWorkspaceRelativePath } from "../common/path.ts";
import { normalizeLineEndings, readTextFile, restoreLineEndings } from "../common/text.ts";

function isFileNotFound(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

export const writeFileTool = tool(
  async ({ path: filePath, content }) => {
    const absolutePath = resolveWorkspacePath(filePath);
    const normalizedContent = normalizeLineEndings(content);
    let finalContent = content;
    let operation: "created" | "updated" = "created";

    try {
      const currentFile = await readTextFile(absolutePath);
      await assertFileFreshForWrite(absolutePath, currentFile.content);
      finalContent = restoreLineEndings(normalizedContent, currentFile.lineEnding);
      operation = "updated";
    } catch (error) {
      if (!isFileNotFound(error)) {
        throw error;
      }
    }

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, finalContent, "utf8");

    const fileStat = await stat(absolutePath);
    updateReadFileState(absolutePath, normalizedContent, fileStat.mtimeMs);

    return `File ${operation}: ${toWorkspaceRelativePath(absolutePath)}`;
  },
  {
    name: "write_file",
    description:
      "Create a new text file or overwrite a previously read text file inside the workspace. Existing files must be read first.",
    schema: z.object({
      path: z.string().describe("File path, relative to the workspace or absolute inside it."),
      content: z.string().describe("Full file content to write."),
    }),
  },
);
