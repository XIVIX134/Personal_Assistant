// app.js

import {
  elements,
  appendMessage,
  updateFilePreview,
  processMessageContent,
  removeLoader,
} from "./ui.js";
import {
  API_BASE_URL,
  sendMessage,
  uploadFile,
  setSystemInstruction,
  deleteCachedContext,
  getConversations,
  deleteConversation,
  generateConversationName,
} from "./api.js";

let selectedFile = null;
let currentConversationId = null;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

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

elements.deleteContextButton.addEventListener("click", async () => {
  try {
    await deleteCachedContext();
    elements.chatBox.innerHTML = "";
    appendMessage(
      "system",
      "Chat history and cached context have been deleted."
    );
  } catch (error) {
    console.error("Error deleting cached context:", error);
    appendMessage("system", "Failed to delete cached context.");
  }
});

elements.systemInstructionButton.addEventListener("click", () => {
  const instruction = prompt("Enter system instruction:");
  if (instruction) {
    setSystemInstruction(instruction)
      .then(() => {
        appendMessage("system", "System instruction has been set.");
      })
      .catch((error) => {
        console.error("Error setting system instruction:", error);
        appendMessage("system", "Failed to set system instruction.");
      });
  }
});

elements.voiceInput.addEventListener("click", toggleVoiceRecording);

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

async function handleSendMessage() {
  const message = elements.chatInput.value.trim();
  if (!message && !selectedFile) return;

  elements.chatInput.value = "";

  let fileData = null;
  if (selectedFile) {
    fileData = await uploadFile(selectedFile);
  }

  // Append user message immediately
  appendMessage("user", message, fileData);

  const loadingMessage = appendMessage("bot", "loading");

  try {
    let { response, conversationId, conversationName, conversations } =
      await sendMessage(message, fileData, currentConversationId);

    if (!currentConversationId) {
      currentConversationId = conversationId;
    }

    removeLoader(loadingMessage);

    // Append bot response
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
    // Highlight the active conversation
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
      // Update existing conversation
      const nameSpan = existingItem.querySelector(".conversation-name");
      if (nameSpan) {
        nameSpan.textContent = conv.name || "Untitled Conversation";
      }
    } else {
      // Add new conversation
      addConversationToList(conv.id, conv.name || "Untitled Conversation");
    }
  });
  // Highlight the active conversation
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

// Load conversations when the page loads
loadConversations();

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
