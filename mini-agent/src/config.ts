import "dotenv/config";

export const config = {
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
  DEEPSEEK_MODEL: process.env.DEEPSEEK_MODEL || "",
};
