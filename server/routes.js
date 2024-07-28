import express from "express";
import * as chatController from "./controllers/chatController.js";

export default function (genAI, upload) {
  const router = express.Router();

  // Chat-related routes
  router.post("/send-message", chatController.sendMessage(genAI));
  router.get("/get-system-instruction", chatController.getSystemInstruction());
  router.post("/set-system-instruction", chatController.setSystemInstruction());
  router.post("/delete-chat-history", chatController.deleteChatHistory());

  // Conversation management routes
  router.get("/conversations", chatController.getConversations());
  router.post("/delete-conversation", chatController.deleteConversation());
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

  // File upload route
  router.post("/upload-file", upload.single("file"), chatController.uploadFile);

  return router;
}
