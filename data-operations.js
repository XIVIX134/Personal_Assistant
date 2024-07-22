import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_FILE = path.join(__dirname, 'db.json');

async function readDB() {
  try {
    const data = await fs.readFile(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty DB
      return { userMemory: {}, chatMessages: [], systemMessage: '' };
    }
    throw error;
  }
}

async function writeDB(data) {
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
}

export async function getUserMemory() {
  const db = await readDB();
  return db.userMemory;
}

export async function updateUserMemory(newInfo) {
  const db = await readDB();
  db.userMemory = { ...db.userMemory, ...newInfo };
  await writeDB(db);
}

export async function getChatMessages(limit = 10) {
  const db = await readDB();
  return db.chatMessages.slice(-limit);
}

export async function saveChatMessage(message) {
  const db = await readDB();
  db.chatMessages.push(message);
  await writeDB(db);
}

export async function getSystemMessage() {
  const db = await readDB();
  return db.systemMessage;
}

export async function setSystemMessage(message) {
  const db = await readDB();
  db.systemMessage = message;
  await writeDB(db);
}