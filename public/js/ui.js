// ui.js

export const elements = {
  chatBox: document.getElementById("chat-box"),
  chatInput: document.getElementById("chat-input"),
  sendButton: document.getElementById("send-button"),
  fileInput: document.getElementById("file-input"),
  filePreview: document.getElementById("file-preview"),
  voiceInput: document.getElementById("voice-input"),
  themeToggle: document.getElementById("theme-toggle"),
  deleteContextButton: document.getElementById("delete-context-button"),
  systemInstructionButton: document.getElementById("system-instruction-button"),
};

const svgs = ["Loading_red.svg", "Loading_blue.svg"];
let currentSvgIndex = 0;

export function createLoader() {
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

function createFilePreview(fileData) {
  const previewDiv = document.createElement("div");
  previewDiv.className = "file-preview";

  const { originalName, storedName, mimeType, path } = fileData;
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

function getMimeType(uri) {
  const extension = uri.split(".").pop().toLowerCase();
  const mimeTypes = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    mp4: "video/mp4",
    mp3: "audio/mpeg",
    // Add more as needed
  };
  return mimeTypes[extension] || "application/octet-stream";
}

export function removeLoader(loaderElement) {
  if (loaderElement && loaderElement.parentNode) {
    loaderElement.parentNode.removeChild(loaderElement);
  }
}

export function processMessageContent(element) {
  // Decode HTML entities first
  const decodedContent = decodeHtmlEntities(element.innerHTML);

  // Use marked to parse Markdown
  const rawMarkup = marked.parse(decodedContent, {
    breaks: true,
    gfm: true,
    tables: true,
  });

  // Sanitize the content
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

  // Apply syntax highlighting to code blocks
  element.querySelectorAll("pre code").forEach((block) => {
    hljs.highlightElement(block);
  });

  // Render LaTeX
  renderMathInElement(element);
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

export function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
  localStorage.setItem(
    "darkMode",
    document.body.classList.contains("dark-mode")
  );
}

export function loadDarkModePreference() {
  const darkMode = localStorage.getItem("darkMode");
  if (darkMode === "true") {
    document.body.classList.add("dark-mode");
  }
}

// Call this function when the page loads
loadDarkModePreference();

// Add event listener for theme toggle
elements.themeToggle.addEventListener("click", toggleDarkMode);
