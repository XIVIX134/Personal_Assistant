// app.js

import {
  elements,
  appendMessage,
  updateFilePreview,
  removeLoader,
  setTheme,
  initializeSettingsPanel,
  updateSystemInstructionDisplay,
} from "./ui.js";
import {
  API_BASE_URL,
  sendMessage,
  uploadFile,
  setSystemInstruction as apiSetSystemInstruction,
  getConversations,
  deleteConversation,
  getSystemInstruction,
} from "./api.js";

let selectedFile = null;
let currentConversationId = null;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Initialize settings panel
initializeSettingsPanel();

// Event Listeners
elements.sendButton.addEventListener("click", handleSendMessage);
elements.chatInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
});

elements.fileInput.addEventListener("change", (e) => {
  selectedFile = e.target.files[0];
  if (selectedFile) {
    updateFilePreview(selectedFile);
  }
});

elements.voiceInput.addEventListener("click", toggleVoiceRecording);

document.getElementById("save-settings").addEventListener("click", function () {
  const newInstruction = document.getElementById(
    "system-instruction-input"
  ).value;
  updateSystemInstruction(newInstruction);
});

document.addEventListener("DOMContentLoaded", function () {
  const systemInstructionInput = document.getElementById(
    "system-instruction-input"
  );

  if (systemInstructionInput) {
    // Initial resize
    autoResizeTextarea(systemInstructionInput);

    // Resize on input
    systemInstructionInput.addEventListener("input", function () {
      autoResizeTextarea(this);
    });

    // Resize when the value is set programmatically
    const originalSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;
    Object.defineProperty(systemInstructionInput, "value", {
      set: function (value) {
        originalSetter.call(this, value);
        autoResizeTextarea(this);
      },
    });
  }
});

// Sidebar toggle
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebar = document.getElementById("sidebar");

sidebarToggle.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Close sidebar when clicking outside of it
document.addEventListener("click", (event) => {
  if (
    !sidebar.contains(event.target) &&
    !sidebarToggle.contains(event.target)
  ) {
    sidebar.classList.remove("open");
  }
});

// New conversation button
const newConversationBtn = document.getElementById("new-conversation");
newConversationBtn.addEventListener("click", createNewConversation);

// Message Handling
async function handleSendMessage() {
  const message = elements.chatInput.value.trim();
  if (!message && !selectedFile) return;

  elements.chatInput.value = "";

  let fileData = null;
  if (selectedFile) {
    fileData = await uploadFile(selectedFile);
  }

  appendMessage("user", message, fileData);

  const loadingMessage = appendMessage("bot", "loading");

  try {
    const systemInstruction = localStorage.getItem("systemInstruction") || "";
    let { response, conversationId, conversationName, conversations } =
      await sendMessage(
        message,
        fileData,
        currentConversationId,
        systemInstruction
      );

    if (!currentConversationId) {
      currentConversationId = conversationId;
    }

    removeLoader(loadingMessage);
    appendMessage("bot", response);

    updateConversationList(conversations);
    updateCurrentConversationName(conversationName);
  } catch (error) {
    console.error("Error sending message:", error);
    removeLoader(loadingMessage);
    appendMessage("system", "Failed to send message.");
  }

  selectedFile = null;
  elements.filePreview.innerHTML = "";
  elements.fileInput.value = "";
}

// Conversation Management
function updateCurrentConversationName(name) {
  const activeConversation = document.querySelector(
    ".conversation-item.active"
  );
  if (activeConversation) {
    const nameSpan = activeConversation.querySelector(".conversation-name");
    if (nameSpan) {
      nameSpan.textContent = name;
    }
  }
}

function addConversationToList(id, name) {
  const conversationList = document.getElementById("conversation-list");
  const li = document.createElement("li");
  li.className = "conversation-item";
  li.dataset.id = id;
  li.innerHTML = `
        <span class="conversation-name">${name}</span>
        <button class="delete-conversation"><i class="fas fa-trash"></i></button>
    `;
  li.querySelector(".delete-conversation").addEventListener("click", (e) => {
    e.stopPropagation();
    handleDeleteConversation(id);
  });
  li.addEventListener("click", () => switchConversation(id));
  conversationList.appendChild(li);
}

async function loadConversations() {
  try {
    const { conversations } = await getConversations();
    const conversationList = document.getElementById("conversation-list");
    conversationList.innerHTML = ""; // Clear existing list
    conversations.forEach((conv) => {
      addConversationToList(conv.id, conv.name || "Untitled Conversation");
    });
    updateActiveConversation(currentConversationId);
  } catch (error) {
    console.error("Error loading conversations:", error);
    appendMessage("system", "Failed to load conversations.");
  }
}

function updateConversationList(conversations) {
  const conversationList = document.getElementById("conversation-list");
  conversations.forEach((conv) => {
    let existingItem = conversationList.querySelector(`[data-id="${conv.id}"]`);
    if (existingItem) {
      const nameSpan = existingItem.querySelector(".conversation-name");
      if (nameSpan) {
        nameSpan.textContent = conv.name || "Untitled Conversation";
      }
    } else {
      addConversationToList(conv.id, conv.name || "Untitled Conversation");
    }
  });
  updateActiveConversation(currentConversationId);
}

async function switchConversation(conversationId) {
  currentConversationId = conversationId;
  elements.chatBox.innerHTML = "";
  try {
    const messages = await getConversationMessages(conversationId);
    if (Array.isArray(messages)) {
      messages.forEach((msg) => {
        appendMessage(
          msg.role === "model" ? "bot" : "user",
          msg.content,
          msg.file
        );
      });
    } else {
      console.error("Received invalid messages data:", messages);
      appendMessage("system", "Failed to load conversation messages.");
    }
  } catch (error) {
    console.error("Error switching conversation:", error);
    appendMessage("system", "Failed to load conversation messages.");
  }
  updateActiveConversation(conversationId);
}

async function getConversationMessages(conversationId) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/conversation-messages/${conversationId}`
    );
    if (!response.ok) {
      throw new Error("Failed to fetch conversation messages");
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching conversation messages:", error);
    throw error;
  }
}

function createNewConversation() {
  currentConversationId = null;
  elements.chatBox.innerHTML = "";
  appendMessage("system", "Started a new conversation");
}

async function handleDeleteConversation(conversationId) {
  try {
    await deleteConversation(conversationId);
    await loadConversations();
    if (currentConversationId === conversationId) {
      createNewConversation();
    }
  } catch (error) {
    console.error("Error deleting conversation:", error);
    appendMessage("system", "Failed to delete conversation.");
  }
}

function updateActiveConversation(conversationId) {
  const conversationItems = document.querySelectorAll(".conversation-item");
  conversationItems.forEach((item) => {
    if (item.dataset.id === conversationId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

// System Instructions
export async function setSystemInstruction(instruction) {
  try {
    await apiSetSystemInstruction(instruction);
    localStorage.setItem("systemInstruction", instruction);
    updateSystemInstructionDisplay(instruction);
    appendMessage("system", "System instruction has been set.");
  } catch (error) {
    console.error("Error setting system instruction:", error);
    appendMessage("system", "Failed to set system instruction.");
  }
}

async function loadSystemInstruction() {
  try {
    const instruction = await getSystemInstruction();
    console.log("Loaded system instruction:", instruction);

    const systemInstructionInput = document.getElementById(
      "system-instruction-input"
    );
    if (systemInstructionInput) {
      systemInstructionInput.value = instruction;
      autoResizeTextarea(systemInstructionInput);
    }

    localStorage.setItem("systemInstruction", instruction);
  } catch (error) {
    console.error("Error loading system instruction:", error);
  }
}

async function updateSystemInstruction(instruction) {
  try {
    const response = await fetch("/api/set-system-instruction", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ instruction }),
    });

    if (!response.ok) {
      throw new Error("Failed to update system instruction");
    }

    const data = await response.json();
    console.log("Updated system instruction:", data.instruction);

    // Update localStorage
    localStorage.setItem("systemInstruction", data.instruction);

    // You might want to update any other parts of your UI that use the system instruction here
  } catch (error) {
    console.error("Error updating system instruction:", error);
  }
}

// Voice Recording
async function toggleVoiceRecording() {
  if (!isRecording) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", async () => {
        const audioBlob = new Blob(audioChunks, { type: "audio/mp3" });
        selectedFile = new File([audioBlob], "voice_message.mp3", {
          type: "audio/mp3",
        });
        updateFilePreview(selectedFile);
      });

      mediaRecorder.start();
      isRecording = true;
      elements.voiceInput.classList.add("recording");
    } catch (error) {
      console.error("Error starting voice recording:", error);
      appendMessage("system", "Failed to start voice recording.");
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    elements.voiceInput.classList.remove("recording");
  }
}

// Initialize
loadConversations();

// Call this function when initializing your app
loadSystemInstruction();

// Load initial system instruction
const initialSystemInstruction =
  localStorage.getItem("systemInstruction") || "";
updateSystemInstructionDisplay(initialSystemInstruction);
