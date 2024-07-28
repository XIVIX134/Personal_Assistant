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
  getConversationMessages,
} from "./api.js";

let selectedFile = null;
let currentConversationId = null;
let isRecording = false;
let mediaRecorder;
let audioChunks = [];

// Initialize the application
function initializeApp() {
  initializeSettingsPanel();
  addEventListeners();
  loadConversations();
  loadSystemInstruction();
}

// Add event listeners
function addEventListeners() {
  elements.sendButton.addEventListener("click", handleSendMessage);
  elements.chatInput.addEventListener("keypress", handleChatInputKeypress);
  elements.fileInput.addEventListener("change", handleFileInputChange);
  elements.voiceInput.addEventListener("click", toggleVoiceRecording);
  document
    .getElementById("save-settings")
    .addEventListener("click", handleSaveSettings);
  document
    .getElementById("sidebar-toggle")
    .addEventListener("click", toggleSidebar);
  document
    .getElementById("new-conversation")
    .addEventListener("click", createNewConversation);
  document.addEventListener("click", handleOutsideClick);
}

// Handle send message
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

// Handle chat input keypress
function handleChatInputKeypress(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

// Handle file input change
function handleFileInputChange(e) {
  selectedFile = e.target.files[0];
  if (selectedFile) {
    updateFilePreview(selectedFile);
  }
}

// Handle save settings
function handleSaveSettings() {
  const newInstruction = document.getElementById(
    "system-instruction-input"
  ).value;
  updateSystemInstruction(newInstruction);
}

// Toggle sidebar
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("open");
}

// Handle outside click to close sidebar
function handleOutsideClick(event) {
  const sidebar = document.getElementById("sidebar");
  const sidebarToggle = document.getElementById("sidebar-toggle");
  if (
    !sidebar.contains(event.target) &&
    !sidebarToggle.contains(event.target)
  ) {
    sidebar.classList.remove("open");
  }
}

// Create new conversation
function createNewConversation() {
  currentConversationId = null;
  elements.chatBox.innerHTML = "";
  appendMessage("system", "Started a new conversation");
}

// Update conversation list
function updateConversationList(conversations) {
  const conversationList = document.getElementById("conversation-list");
  conversationList.innerHTML = "";
  conversations.forEach((conv) => {
    addConversationToList(conv.id, conv.name || "Untitled Conversation");
  });
  updateActiveConversation(currentConversationId);
}

// Add conversation to list
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

// Switch conversation
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

// Handle delete conversation
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

// Update active conversation
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

// Update current conversation name
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

// Load conversations
async function loadConversations() {
  try {
    const { conversations } = await getConversations();
    const conversationList = document.getElementById("conversation-list");
    conversationList.innerHTML = "";
    conversations.forEach((conv) => {
      addConversationToList(conv.id, conv.name || "Untitled Conversation");
    });
    updateActiveConversation(currentConversationId);
  } catch (error) {
    console.error("Error loading conversations:", error);
    appendMessage("system", "Failed to load conversations.");
  }
}

// Load system instruction
async function loadSystemInstruction() {
  try {
    const instruction = await getSystemInstruction();
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

// Update system instruction
async function updateSystemInstruction(instruction) {
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

// Toggle voice recording
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

// Auto-resize textarea
function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// Initialize the application
initializeApp();
