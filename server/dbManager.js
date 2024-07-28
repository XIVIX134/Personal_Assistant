// dbManager.js

import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "db.json");

let cachedSystemInstruction = null;

async function readDb() {
  try {
    const data = await fs.readFile(dbPath, "utf8");
    console.log("Read from db.json:", data);
    return JSON.parse(data);
  } catch (error) {
    console.error("Error reading db.json:", error);
    if (error.code === "ENOENT") {
      console.log(
        "db.json not found. Creating new database with default values."
      );
      const defaultDb = {
        messages: [],
        systemInstruction: config.DEFAULT_SYSTEM_INSTRUCTION,
        conversations: [],
      };
      await writeDb(defaultDb);
      return defaultDb;
    }
    throw error;
  }
}

async function writeDb(data) {
  console.log("Writing to db.json:", JSON.stringify(data));
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
  if (cachedSystemInstruction !== null) {
    console.log(
      "Returning cached system instruction:",
      cachedSystemInstruction
    );
    return cachedSystemInstruction;
  }

  const db = await readDb();
  cachedSystemInstruction =
    db.systemInstruction || config.DEFAULT_SYSTEM_INSTRUCTION;
  console.log("Getting system instruction from DB:", cachedSystemInstruction);
  return cachedSystemInstruction;
}

export async function setSystemInstruction(instruction) {
  console.log("Setting system instruction:", instruction);
  const db = await readDb();
  db.systemInstruction = instruction;
  await writeDb(db);
  cachedSystemInstruction = instruction;
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
