// ui.js

import {
  getSystemInstruction,
  setSystemInstruction as apiSetSystemInstruction,
} from "./api.js";

// DOM Elements
export const elements = {
  chatBox: document.getElementById("chat-box"),
  chatInput: document.getElementById("chat-input"),
  sendButton: document.getElementById("send-button"),
  fileInput: document.getElementById("file-input"),
  filePreview: document.getElementById("file-preview"),
  voiceInput: document.getElementById("voice-input"),
  settingsButton: document.getElementById("settings-button"),
  settingsPanel: document.getElementById("settings-panel"),
  themeSelector: document.getElementById("theme-selector"),
  systemInstructionInput: document.getElementById("system-instruction-input"),
  saveSettingsButton: document.getElementById("save-settings"),
  themeToggle: document.getElementById("theme-toggle"),
};

// Message Handling
export function appendMessage(sender, content, fileData = null) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;

  if (fileData) {
    const filePreview = createFilePreview(fileData);
    messageDiv.appendChild(filePreview);
  }

  if (content === "loading") {
    const loader = createLoader();
    messageDiv.appendChild(loader);
  } else {
    const contentDiv = document.createElement("div");
    contentDiv.innerText = content;
    messageDiv.appendChild(contentDiv);
    processMessageContent(contentDiv);
  }

  elements.chatBox.appendChild(messageDiv);
  elements.chatBox.scrollTop = elements.chatBox.scrollHeight;

  return messageDiv;
}

export function removeLoader(loaderElement) {
  if (loaderElement && loaderElement.parentNode) {
    loaderElement.parentNode.removeChild(loaderElement);
  }
}

function processMessageContent(element) {
  const decodedContent = decodeHtmlEntities(element.innerHTML);
  const rawMarkup = marked.parse(decodedContent, {
    breaks: true,
    gfm: true,
    tables: true,
  });
  const sanitizedContent = DOMPurify.sanitize(rawMarkup, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      "b",
      "i",
      "em",
      "strong",
      "a",
      "p",
      "ul",
      "ol",
      "li",
      "code",
      "pre",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "blockquote",
      "br",
      "span",
    ],
    ALLOWED_ATTR: ["href", "target", "class", "style"],
  });

  element.innerHTML = sanitizedContent;

  element.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });

  renderMathInElement(element);
}

// File Handling
export function updateFilePreview(file) {
  const reader = new FileReader();
  reader.onload = function (e) {
    if (file.type.startsWith("image/")) {
      elements.filePreview.innerHTML = `<img src="${e.target.result}" alt="File preview">`;
    } else if (file.type.startsWith("video/")) {
      elements.filePreview.innerHTML = `<video src="${e.target.result}" controls></video>`;
    } else if (file.type.startsWith("audio/")) {
      elements.filePreview.innerHTML = `<audio src="${e.target.result}" controls></audio>`;
    } else {
      elements.filePreview.innerHTML = `<p>${file.name}</p>`;
    }
  };
  reader.readAsDataURL(file);
}

function createFilePreview(fileData) {
  const previewDiv = document.createElement("div");
  previewDiv.className = "file-preview";

  const { originalName, storedName, mimeType } = fileData;
  const fileUrl = `/uploads/${storedName}`;

  if (mimeType.startsWith("image/")) {
    const img = document.createElement("img");
    img.src = fileUrl;
    img.alt = originalName;
    previewDiv.appendChild(img);
  } else if (mimeType.startsWith("video/")) {
    const video = document.createElement("video");
    video.src = fileUrl;
    video.controls = true;
    previewDiv.appendChild(video);
  } else if (mimeType.startsWith("audio/")) {
    const audio = document.createElement("audio");
    audio.src = fileUrl;
    audio.controls = true;
    previewDiv.appendChild(audio);
  } else {
    const fileLink = document.createElement("a");
    fileLink.href = fileUrl;
    fileLink.textContent = `View uploaded file: ${originalName}`;
    fileLink.target = "_blank";
    previewDiv.appendChild(fileLink);
  }

  return previewDiv;
}

// Settings Panel
export function initializeSettingsPanel() {
  if (elements.settingsButton)
    elements.settingsButton.addEventListener("click", toggleSettingsPanel);
  if (elements.saveSettingsButton)
    elements.saveSettingsButton.addEventListener("click", saveSettings);
  if (elements.themeSelector)
    elements.themeSelector.addEventListener("change", handleThemeChange);
  loadSettings();
}

async function loadSettings() {
  const theme = localStorage.getItem("theme") || "light";
  elements.themeSelector.value = theme;
  setTheme(theme);

  try {
    const systemInstruction = await getSystemInstruction();
    elements.systemInstructionInput.value = systemInstruction;
  } catch (error) {
    console.error("Error loading system instruction:", error);
    elements.systemInstructionInput.value = "";
  }
}

async function saveSettings() {
  const theme = elements.themeSelector.value;
  const systemInstruction = elements.systemInstructionInput.value;

  localStorage.setItem("theme", theme);

  try {
    await apiSetSystemInstruction(systemInstruction);
    appendMessage("system", "Settings saved successfully.");
  } catch (error) {
    console.error("Error saving system instruction:", error);
    appendMessage("system", "Failed to save system instruction.");
  }

  toggleSettingsPanel();
}

export function updateSystemInstructionDisplay(instruction) {
  if (elements.systemInstructionInput) {
    elements.systemInstructionInput.value = instruction;
  }
}

function toggleSettingsPanel() {
  elements.settingsPanel.classList.toggle("open");
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = textarea.scrollHeight + "px";
}

// Theme Handling
export function setTheme(theme) {
  document.body.classList.remove("light-mode", "dark-mode");
  document.body.classList.add(`${theme}-mode`);
}

function handleThemeChange(event) {
  const newTheme = event.target.value;
  setTheme(newTheme);
}

function toggleTheme() {
  const currentTheme = document.body.classList.contains("dark-mode")
    ? "light"
    : "dark";
  setTheme(currentTheme);
  localStorage.setItem("theme", currentTheme);
}

// Utility Functions
function createLoader() {
  const loader = document.createElement("div");
  loader.className = "loader";

  const redSvg = document.createElement("div");
  redSvg.className = "loader-svg red";
  loader.appendChild(redSvg);

  const blueSvg = document.createElement("div");
  blueSvg.className = "loader-svg blue";
  loader.appendChild(blueSvg);

  return loader;
}

function decodeHtmlEntities(text) {
  const textArea = document.createElement("textarea");
  textArea.innerHTML = text;
  return textArea.value;
}

function renderMathInElement(element) {
  if (window.MathJax) {
    if (typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise([element]).catch((err) =>
        console.error("MathJax error:", err)
      );
    } else if (typeof window.MathJax.typeset === "function") {
      window.MathJax.typeset([element]);
    } else {
      console.warn(
        "MathJax is available, but typesetPromise and typeset methods are not found."
      );
    }
  } else {
    console.warn("MathJax is not available. LaTeX rendering is disabled.");
  }
}

// Initialize
loadSettings();
initializeSettingsPanel();
