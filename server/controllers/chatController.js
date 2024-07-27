// chatController.js

import {
  GoogleGenerativeAI,
  HarmCategory,
  HarmBlockThreshold,
} from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { promises as fs } from "fs";
import * as dbManager from "../dbManager.js";
import config from "../config.js";

const fileManager = new GoogleAIFileManager(config.API_KEY);
const genAI = new GoogleGenerativeAI(config.API_KEY);

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are a helpful AI assistant named Skyhammer AI. Your goal is to provide information, complete tasks, and engage in conversation. You have a wide range of knowledge on various topics including science, technology, history, culture, and current events. You can assist with analysis, question answering, coding, creative writing, and general discussion. Always strive to give accurate and helpful responses while being respectful and ethical. If you're unsure about something, it's okay to say so. Try to tailor your language and tone to what seems most appropriate for each user and conversation.";

// Add this function at the top of the file:
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function sendMessage() {
  return async (req, res) => {
    try {
      const { message, fileData, conversationId } = req.body;
      let currentConversationId = conversationId || generateUUID();
      let isNewConversation = !conversationId;

      // Get chat history and system instruction
      const messages = await dbManager.getMessages(currentConversationId);
      let systemInstruction = await dbManager.getSystemInstruction();
      if (!systemInstruction) {
        systemInstruction = DEFAULT_SYSTEM_INSTRUCTION;
        await dbManager.setSystemInstruction(systemInstruction);
      }

      // Prepare the contents array
      const contents = [
        { role: "user", parts: [{ text: systemInstruction }] },
        ...messages.map((m) => ({
          role: m.role === "assistant" ? "model" : m.role,
          parts: [{ text: m.content }],
        })),
        { role: "user", parts: [{ text: message }] },
      ];

      // Add file to contents if it exists
      if (fileData && fileData.path) {
        try {
          let fileUri;
          if (fileData.mimeType.startsWith("video/")) {
            // Upload video file using File API
            const uploadResult = await fileManager.uploadFile(fileData.path, {
              mimeType: fileData.mimeType,
            });
            fileUri = uploadResult.file.uri;

            // Wait for the video to be processed
            let file = await fileManager.getFile(uploadResult.file.name);
            while (file.state === "PROCESSING") {
              await new Promise((resolve) => setTimeout(resolve, 2000));
              file = await fileManager.getFile(uploadResult.file.name);
            }

            if (file.state === "FAILED") {
              throw new Error("Video processing failed.");
            }
          } else {
            // For non-video files, read the file content
            const fileContent = await fs.readFile(fileData.path, {
              encoding: "base64",
            });
            fileUri = `data:${fileData.mimeType};base64,${fileContent}`;
          }

          contents[contents.length - 1].parts.push({
            fileData: {
              mimeType: fileData.mimeType,
              fileUri: fileUri,
            },
          });
        } catch (error) {
          console.error("Error processing file:", error);
          return res
            .status(500)
            .json({ error: "Failed to process uploaded file." });
        }
      }

      // Generate content

      const safetySettings = [
        {
          category: HarmCategory.HARM_CATEGORY_HARASSMENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
        {
          category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
          threshold: HarmBlockThreshold.BLOCK_NONE,
        },
      ];

      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        safetySettings: safetySettings,
      });

      console.log("Request payload:", JSON.stringify({ contents }, null, 2));

      const result = await model.generateContent({ contents });
      const response = result.response.text();

      // Save messages to db
      let conversationName;
      if (isNewConversation) {
        const namePrompt = `Generate a short, catchy title (2-5 words) for a conversation that starts with this message: "${message}". Respond with only the title, no additional text.`;
        const nameResult = await model.generateContent(namePrompt);
        conversationName = nameResult.response
          .text()
          .trim()
          .split(" ")
          .slice(0, 5)
          .join(" ");
        await dbManager.addConversation(
          currentConversationId,
          conversationName,
          message,
          fileData
        );
      } else {
        await dbManager.addMessage(
          { role: "user", content: message, file: fileData },
          currentConversationId
        );
        const existingConversation = await dbManager.getConversation(
          currentConversationId
        );
        conversationName = existingConversation.name;
      }

      await dbManager.addMessage(
        { role: "model", content: response },
        currentConversationId
      );

      // Fetch the updated conversation list
      const conversations = await dbManager.getConversations();

      res.json({
        response,
        conversationId: currentConversationId,
        conversationName: conversationName,
        conversations: conversations,
      });
    } catch (error) {
      console.error("Error in sendMessage:", error);
      console.error("Error stack:", error.stack);
      res.status(500).json({
        error: "An error occurred while processing your request.",
        details: error.message,
      });
    }
  };
}

export function getConversations() {
  return async (req, res) => {
    try {
      const conversations = await dbManager.getConversations();
      res.json({ conversations });
    } catch (error) {
      console.error("Error in getConversations:", error);
      res
        .status(500)
        .json({ error: "An error occurred while fetching conversations." });
    }
  };
}

export function getConversationMessages() {
  return async (req, res) => {
    try {
      const { conversationId } = req.params;
      const messages = await dbManager.getMessages(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching conversation messages:", error);
      res.status(500).json({ error: "Failed to fetch conversation messages" });
    }
  };
}

export function deleteConversation() {
  return async (req, res) => {
    try {
      const { conversationId } = req.body;
      await dbManager.deleteConversation(conversationId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error in deleteConversation:", error);
      res
        .status(500)
        .json({ error: "An error occurred while deleting the conversation." });
    }
  };
}

export function updateConversationName() {
  return async (req, res) => {
    try {
      const { conversationId, name } = req.body;
      await dbManager.updateConversationName(conversationId, name);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating conversation name:", error);
      res.status(500).json({ error: "Failed to update conversation name" });
    }
  };
}

export function uploadFile(req, res) {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  const fileUri = `uploads/${req.file.filename}`;
  res.json({ fileUri });
}

export function setSystemInstruction() {
  return async (req, res) => {
    try {
      const { instruction } = req.body;
      await dbManager.setSystemInstruction(
        instruction || DEFAULT_SYSTEM_INSTRUCTION
      );
      res.json({ success: true });
    } catch (error) {
      console.error("Error in sendMessage:", error);
      res
        .status(500)
        .json({ error: "An error occurred while processing your request." });
    }
  };
}

export function deleteChatHistory() {
  return async (req, res) => {
    try {
      await dbManager.clearMessages();
      res.json({ success: true });
    } catch (error) {
      console.error("Error in deleteChatHistory:", error);
      res
        .status(500)
        .json({ error: "An error occurred while deleting the chat history." });
    }
  };
}

export function generateConversationName(genAI) {
  return async (req, res) => {
    try {
      const { message } = req.body;
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Generate a short, catchy title (2-5 words) for a conversation that starts with this message: "${message}". Respond with only the title, no additional text.`;

      const result = await model.generateContent(prompt);
      let name = result.response.text().trim();
      // Ensure the name is not too long
      name = name.split(" ").slice(0, 5).join(" ");

      res.json({ name });
    } catch (error) {
      console.error("Error generating conversation name:", error);
      res.status(500).json({ error: "Failed to generate conversation name" });
    }
  };
}
