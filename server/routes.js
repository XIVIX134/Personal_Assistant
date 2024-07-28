// routes.js

import express from "express";
import fs from "fs/promises";
import * as chatController from "./controllers/chatController.js";

export default function (genAI, upload) {
  const router = express.Router();

  router.post("/send-message", chatController.sendMessage(genAI));
  router.post("/upload-file", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    try {
      const fileContent = await fs.readFile(req.file.path, {
        encoding: "base64",
      });
      res.json({ fileUri: fileContent });
    } catch (error) {
      console.error("Error reading uploaded file:", error);
      res.status(500).json({ error: "Failed to process uploaded file." });
    }
  });

  router.get("/get-system-instruction", chatController.getSystemInstruction());

  router.post("/set-system-instruction", chatController.setSystemInstruction());
  router.post("/delete-chat-history", chatController.deleteChatHistory());

  router.get("/conversations", chatController.getConversations());
  router.post("/delete-conversation", chatController.deleteConversation());

  // New route for fetching conversation messages
  router.get(
    "/conversation-messages/:conversationId",
    chatController.getConversationMessages()
  );
  router.post(
    "/generate-conversation-name",
    chatController.generateConversationName(genAI)
  );
  router.post(
    "/update-conversation-name",
    chatController.updateConversationName()
  );

  return router;
}
