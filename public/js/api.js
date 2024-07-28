// api.js

export const API_BASE_URL = "/api";

// Generate a UUID
function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Send a message to the server
export async function sendMessage(
  message,
  fileData = null,
  conversationId = null
) {
  const body = { message, conversationId };
  if (fileData) {
    body.fileData = {
      originalName: fileData.originalName,
      storedName: fileData.storedName,
      mimeType: fileData.mimeType,
      path: fileData.path,
    };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/send-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || `Failed to send message: ${response.statusText}`
      );
    }

    const data = await response.json();
    return {
      response: data.response,
      conversationId: data.conversationId,
      conversationName: data.conversationName,
      conversations: data.conversations,
    };
  } catch (error) {
    console.error("Error in sendMessage:", error);
    throw error;
  }
}

// Upload a file to the server
export async function uploadFile(file) {
  const originalName = file.name;
  const extension = originalName.split(".").pop();
  const randomName = generateUUID() + "." + extension;

  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await fetch(`${API_BASE_URL}/upload-file`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      originalName: originalName,
      storedName: data.filename,
      mimeType: file.type,
      path: data.path,
    };
  } catch (error) {
    console.error("Error uploading file:", error);
    throw new Error("Failed to upload file");
  }
}

// Get system instruction
export async function getSystemInstruction() {
  try {
    const response = await fetch(`${API_BASE_URL}/get-system-instruction`);
    if (!response.ok) {
      throw new Error(
        `Failed to get system instruction: ${response.statusText}`
      );
    }
    const data = await response.json();
    return data.instruction;
  } catch (error) {
    console.error("Error getting system instruction:", error);
    throw error;
  }
}

// Set system instruction
export async function setSystemInstruction(instruction) {
  try {
    const response = await fetch(`${API_BASE_URL}/set-system-instruction`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    if (!response.ok) {
      throw new Error(
        `Failed to set system instruction: ${response.statusText}`
      );
    }
    return response.json();
  } catch (error) {
    console.error("Error setting system instruction:", error);
    throw error;
  }
}

// Get conversations
export async function getConversations() {
  try {
    const response = await fetch(`${API_BASE_URL}/conversations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch conversations: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error("Error in getConversations:", error);
    throw error;
  }
}

// Delete conversation
export async function deleteConversation(conversationId) {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-conversation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId }),
    });
    if (!response.ok) {
      throw new Error(`Failed to delete conversation: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    console.error("Error in deleteConversation:", error);
    throw error;
  }
}

// Delete cached context
export async function deleteCachedContext() {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-chat-history`, {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error(
        `Failed to delete cached context: ${response.statusText}`
      );
    }

    return response.json();
  } catch (error) {
    console.error("Error in deleteCachedContext:", error);
    throw error;
  }
}

// Get conversation messages
export async function getConversationMessages(conversationId) {
  const response = await fetch(
    `${API_BASE_URL}/conversation-messages/${conversationId}`
  );
  if (!response.ok) {
    throw new Error("Failed to fetch conversation messages");
  }
  return response.json();
}

// Generate conversation name
export async function generateConversationName(message) {
  try {
    const response = await fetch(`${API_BASE_URL}/generate-conversation-name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to generate conversation name: ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.name;
  } catch (error) {
    console.error("Error generating conversation name:", error);
    return "New Conversation";
  }
}
