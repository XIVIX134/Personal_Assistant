import dotenv from "dotenv";

dotenv.config();

export default {
  API_KEY: process.env.GEMINI_API_KEY,
  MODEL_NAME: "gemini-1.5-flash",
  DEFAULT_SYSTEM_INSTRUCTION:
    process.env.DEFAULT_SYSTEM_INSTRUCTION ||
    "You are a helpful AI assistant named Skyhammer AI. Your goal is to provide information, complete tasks, and engage in conversation.",
};
