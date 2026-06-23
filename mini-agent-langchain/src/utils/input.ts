/**
 * 格式化输入
 */
export function joinArgs(args: string[]) {
  return args.join(" ").trim();
}

export function ensureInput(input: string, message = "请输入内容") {
  if (input.length > 0) return true;
  console.error(message);
  process.exitCode = 1;
  return false;
}
