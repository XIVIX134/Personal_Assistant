import dotenv from "dotenv";

dotenv.config();

export default {
  API_KEY: process.env.GEMINI_API_KEY,
  MODEL_NAME: "gemini-1.5-flash",
};
