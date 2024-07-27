// dbManager.js

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "db.json");

async function readDb() {
  try {
    const data = await fs.readFile(dbPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      return { messages: [], systemInstruction: "", conversations: [] };
    }
    throw error;
  }
}

async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
}

export async function getMessages(conversationId = "default") {
  const db = await readDb();
  const conversation = db.conversations.find(
    (c) => c.id === conversationId
  ) || { messages: [] };
  return conversation.messages;
}

export async function addMessage(message, conversationId = "default") {
  const db = await readDb();
  const validRole = message.role === "assistant" ? "model" : message.role;
  const conversation = db.conversations.find((c) => c.id === conversationId);

  if (conversation) {
    conversation.messages.push({
      role: validRole,
      content: message.content,
      file: message.file || null,
    });
    conversation.lastUpdated = new Date().toISOString();
  } else {
    db.conversations.push({
      id: conversationId,
      messages: [
        {
          role: validRole,
          content: message.content,
          file: message.file || null,
        },
      ],
      created: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    });
  }

  await writeDb(db);
}

export async function clearMessages(conversationId = "default") {
  const db = await readDb();
  const conversationIndex = db.conversations.findIndex(
    (c) => c.id === conversationId
  );

  if (conversationIndex !== -1) {
    db.conversations[conversationIndex].messages = [];
    db.conversations[conversationIndex].lastUpdated = new Date().toISOString();
  }

  await writeDb(db);
}

export async function getSystemInstruction() {
  const db = await readDb();
  return db.systemInstruction || "";
}

export async function setSystemInstruction(instruction) {
  const db = await readDb();
  db.systemInstruction = instruction;
  await writeDb(db);
}

export async function getConversations() {
  const db = await readDb();
  return db.conversations.map(({ id, name, created, lastUpdated }) => ({
    id,
    name,
    created,
    lastUpdated,
  }));
}

export async function deleteConversation(conversationId) {
  const db = await readDb();
  db.conversations = db.conversations.filter((c) => c.id !== conversationId);
  await writeDb(db);
}

export async function addConversation(id, name, message, fileData = null) {
  const db = await readDb();
  db.conversations.push({
    id,
    name,
    messages: [
      {
        role: "user",
        content: message,
        file: fileData,
      },
    ],
    created: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
  });
  await writeDb(db);
}

export async function updateConversationName(id, name) {
  const db = await readDb();
  const conversation = db.conversations.find((c) => c.id === id);
  if (conversation) {
    conversation.name = name;
    conversation.lastUpdated = new Date().toISOString();
    await writeDb(db);
  }
}

export async function getConversation(conversationId) {
  const db = await readDb();
  return db.conversations.find((c) => c.id === conversationId);
}
