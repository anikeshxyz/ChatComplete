import { BASE_URL } from './config.js';

export async function loginUser(requestData) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/login-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.detail || "Login failed");
    }

    return responseData;
  } catch (error) {
    console.error("Error during login:", error);
    throw error;
  }
}

export async function registerUser(formData) {
  try {
    const response = await fetch("${BASE_URL}/api/v1/create-user", {
      method: "POST",
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorMsg = responseData.detail || responseData.message || responseData.error || "Registration failed";
      throw new Error(errorMsg);
    }

    return responseData;
  } catch (error) {
    console.error("Error during registration:", error);
    throw error;
  }
}

export async function sendOtp(phoneNumber) {
  try {
    const response = await fetch("${BASE_URL}/api/v1/send-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Failed to send OTP");
    }
    return data;
  } catch (error) {
    console.error("Error sending OTP:", error);
    throw error;
  }
}

export async function verifyOtp(phoneNumber, otp) {
  try {
    const response = await fetch("${BASE_URL}/api/v1/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, otp }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "OTP verification failed");
    }
    return data;
  } catch (error) {
    console.error("Error verifying OTP:", error);
    throw error;
  }
}

export async function loginWithOtp(phoneNumber, otp) {
  try {
    const response = await fetch("${BASE_URL}/api/v1/login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber, otp }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }
    return data;
  } catch (error) {
    console.error("Error during OTP login:", error);
    throw error;
  }
}

export async function searchUsersByName(query) {
  if (query.length < 2) {
    return [];
  }

  const response = await fetch(`${BASE_URL}/api/v1/search-user?name=${encodeURIComponent(query)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
  });

  if (!response.ok) {
    const errorMsg = await response.text();
    throw new Error(errorMsg || `Server error: ${response.status}`);
  }

  return await response.json();
}


export async function logout() {
  try {
    const response = await fetch("${BASE_URL}/api/v1/logout", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Logout failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Network error during logout:", error);
    throw error;
  }
}

export async function fetchPreviousConversations(sender, receiver) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/conversations?sender=${encodeURIComponent(sender)}&receiver=${encodeURIComponent(receiver)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const errorMsg = await response.text();
      throw new Error(errorMsg || `Server error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching previous conversations:", error);
    throw error;
  }

}

export async function updateProfilePicture(formData) {
  try {
    const response = await fetch("${BASE_URL}/api/v1/update-profile-picture", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.description || errorData.message || `Upload failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating profile picture:", error);
    throw error;
  }
}

export async function updateAbout(about) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/update-about?about=${encodeURIComponent(about)}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.description || errorData.message || `Update failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error updating about:", error);
    throw error;
  }
}

export async function createGroup(name, memberUsernames) {
  try {
    const response = await fetch("${BASE_URL}/api/v1/groups/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({ name, memberUsernames }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.description || errorData.message || `Create group failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error creating group:", error);
    throw error;
  }
}

export async function addGroupMembers(groupId, memberUsernames) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/groups/${groupId}/add-members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify(memberUsernames),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.description || errorData.message || `Add members failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error adding group members:", error);
    throw error;
  }
}

export async function getMyGroups() {
  try {
    const response = await fetch("${BASE_URL}/api/v1/groups/my-groups", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.description || errorData.message || `Fetch groups failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching groups:", error);
    throw error;
  }
}

export async function getGroupMessages(groupId) {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/groups/${groupId}/messages`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.description || errorData.message || `Fetch group messages failed with status ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching group messages:", error);
    throw error;
  }
}

export async function uploadChatFile(formData) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch("${BASE_URL}/api/v1/upload-chat-file", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        // Do NOT set Content-Type — browser sets it with boundary automatically for FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const msg = errorData.description || errorData.message || `File upload failed (${response.status})`;
      throw new Error(msg);
    }

    return await response.json();
  } catch (error) {
    console.error("Error uploading chat file:", error);
    throw error;
  }
}

export async function getOnlineUsers() {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch("${BASE_URL}/api/v1/online-users", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch online users (${response.status})`);
    }

    return await response.json(); // Returns Set<String> (array of usernames)
  } catch (error) {
    console.error("Error fetching online users:", error);
    return [];
  }
}

export async function deleteMessage(messageId) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/api/v1/messages/${messageId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Failed to delete message (${response.status})`);
    }

    return await response.text();
  } catch (error) {
    console.error("Error deleting message:", error);
    throw error;
  }
}

export async function editMessageApi(messageId, newContent) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/api/v1/messages/${messageId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messageId, newContent }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Failed to edit message (${response.status})`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error editing message:", error);
    throw error;
  }
}

export async function clearChatApi(receiver) {
  try {
    const token = localStorage.getItem("token");
    const response = await fetch(`${BASE_URL}/api/v1/conversations?receiver=${encodeURIComponent(receiver)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Failed to clear chat (${response.status})`);
    }

    return true;
  } catch (error) {
    console.error("Error clearing chat:", error);
    throw error;
  }
}