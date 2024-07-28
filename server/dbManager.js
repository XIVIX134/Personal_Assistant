import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, "db.json");

let cachedSystemInstruction = null;

// Read database from file
async function readDb() {
  try {
    const data = await fs.readFile(dbPath, "utf8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
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

// Write database to file
async function writeDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf8");
}

// Get messages for a specific conversation
export async function getMessages(conversationId = "default") {
  const db = await readDb();
  const conversation = db.conversations.find(
    (c) => c.id === conversationId
  ) || { messages: [] };
  return conversation.messages;
}

// Add a message to a conversation
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

// Clear messages for a specific conversation
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

// Get system instruction
export async function getSystemInstruction() {
  if (cachedSystemInstruction !== null) {
    return cachedSystemInstruction;
  }

  const db = await readDb();
  cachedSystemInstruction =
    db.systemInstruction || config.DEFAULT_SYSTEM_INSTRUCTION;
  return cachedSystemInstruction;
}

// Set system instruction
export async function setSystemInstruction(instruction) {
  const db = await readDb();
  db.systemInstruction = instruction;
  await writeDb(db);
  cachedSystemInstruction = instruction;
}

// Get all conversations
export async function getConversations() {
  const db = await readDb();
  return db.conversations.map(({ id, name, created, lastUpdated }) => ({
    id,
    name,
    created,
    lastUpdated,
  }));
}

// Delete a conversation
export async function deleteConversation(conversationId) {
  const db = await readDb();
  db.conversations = db.conversations.filter((c) => c.id !== conversationId);
  await writeDb(db);
}

// Add a new conversation
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

// Update conversation name
export async function updateConversationName(id, name) {
  const db = await readDb();
  const conversation = db.conversations.find((c) => c.id === id);
  if (conversation) {
    conversation.name = name;
    conversation.lastUpdated = new Date().toISOString();
    await writeDb(db);
  }
}

// Get a specific conversation
export async function getConversation(conversationId) {
  const db = await readDb();
  return db.conversations.find((c) => c.id === conversationId);
}
