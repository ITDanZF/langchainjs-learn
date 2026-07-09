import { editFileTool } from "./io/editFile.ts";
import { listFilesTool } from "./io/listFiles.ts";
import { readFileTool } from "./io/readFile.ts";
import { searchTextTool } from "./io/searchText.ts";
import { writeFileTool } from "./io/writeFile.ts";

export function createTools() {
  return [
    readFileTool,
    writeFileTool,
    editFileTool,
    listFilesTool,
    searchTextTool,
  ];
}

export default class Tools {
  getTools() {
    return createTools();
  }
}
