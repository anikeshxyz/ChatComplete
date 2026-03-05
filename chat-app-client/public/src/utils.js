import { BASE_URL } from './config.js';
import { getCurrentReceiver } from "./userService";
import { deleteMessage } from "./apiService";
const searchResultContainer = document.getElementById("search-results-container");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");

/**
 * Escapes HTML special characters so user-supplied strings are safe
 * to embed inside innerHTML without enabling XSS.
 *
 * This is the FRONTEND defence-in-depth layer.  The backend XssFilter
 * is the first line of defence; this covers anything that slips through
 * or is stored/reflected from another path.
 *
 * @param {string|null|undefined} str - Raw value to escape
 * @returns {string} - HTML-safe string
 */
export function sanitize(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  // Note: '/' is intentionally NOT escaped — it's not an XSS vector in HTML
  // text/attribute contexts and escaping it breaks URLs in href/src attributes.
}

export function isValidPassword(password) {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasSpecialChar &&
    hasNumber
  );
}

export function setupPasswordToggle() {
  const toggleButtons = document.querySelectorAll(".toggle-password");

  toggleButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const input = this.parentElement.querySelector("input");
      const icon = this.querySelector("i");

      if (input.type === "password") {
        input.type = "text";
        icon.classList.replace("fa-eye", "fa-eye-slash");
      } else {
        input.type = "password";
        icon.classList.replace("fa-eye-slash", "fa-eye");
      }
    });
  });
}

export function displayErrorMessages(messages) {
  if (errorText) errorText.innerHTML = messages;
  if (errorMessage) errorMessage.style.display = "block";
}

export function showMessage(message) {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  const currentReceiver = getCurrentReceiver();
  const currentUser = localStorage.getItem("username");

  const isCurrentConversation =
    (message.sender === currentUser && message.receiver === currentReceiver) ||
    (message.sender === currentReceiver && message.receiver === currentUser);

  if (!isCurrentConversation) return;

  const isSender = message.sender === currentUser;
  const isReceiver = message.sender === currentReceiver || message.receiver === currentUser;

  if (!isSender && !isReceiver) return;

  const messageElement = document.createElement("div");
  messageElement.classList.add(
    isSender ? "message-contents-sender" : "message-contents-receiver"
  );

  if (message.id) {
    messageElement.setAttribute("data-message-id", message.id);
  }

  const time = new Date(message.time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  let contentHtml = '';

  if (message.fileUrl) {
    // Normalize to full URL
    let fileUrl = message.fileUrl.replace(/['"]/g, '').trim();
    if (fileUrl && !fileUrl.startsWith('http')) {
      fileUrl = `${BASE_URL}/uploads/${fileUrl}`;
    }

    // Sanitize the URL — reject anything that isn't http(s)
    const safeUrl = /^https?:\/\//i.test(fileUrl) ? fileUrl : '#';
    const safeFileName = sanitize(message.fileName || 'File');
    const safeFileType = sanitize(message.fileType || 'File');

    if (message.fileType && message.fileType.startsWith('image/')) {
      // Image message — show thumbnail
      contentHtml = `
        <div class="file-message image-message">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">
            <img src="${safeUrl}" alt="${safeFileName}" class="chat-image" />
          </a>
        </div>
      `;
    } else {
      // File message — show download link
      contentHtml = `
        <div class="file-message file-attachment">
          <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="file-download-link">
            <i class="fa fa-file-o"></i>
            <span class="file-info">
              <span class="file-name-text">${safeFileName}</span>
              <span class="file-type-text">${safeFileType}</span>
            </span>
            <i class="fa fa-download"></i>
          </a>
        </div>
      `;
    }
  }

  // Also show text if present alongside a file
  if (message.message) {
    contentHtml += `<h6>${sanitize(message.message)}</h6>`;
  }

  let statusHtml = '';
  if (isSender) {
    let iconClass = 'fa-check'; // default SENT
    let extraClass = '';

    if (message.status === 'DELIVERED') {
      iconClass = 'fa-check-double';
    } else if (message.status === 'READ') {
      iconClass = 'fa-check-double';
      extraClass = 'read';
    } else if (!message.status) {
      iconClass = 'fa-check'; // fallback if no status
    }

    statusHtml = '';
    if (message.id) {
      statusHtml += `
        <div class="msg-dropdown-container">
          <button class="msg-options-btn" onclick="window.toggleMessageMenu(event, ${message.id})"><i class="fa fa-ellipsis-v"></i></button>
          <div class="msg-dropdown-menu" id="msg-menu-${message.id}">
            <div class="msg-dropdown-item" onclick="window.editMessageFrontend(${message.id}, this)">
              <i class="fa fa-pencil"></i> Edit
            </div>
            <div class="msg-dropdown-item delete" onclick="window.deleteMessageFrontend(${message.id}, this)">
              <i class="fa fa-trash"></i> Delete
            </div>
          </div>
        </div>
      `;
    }
    statusHtml += `<i class="fa ${iconClass} message-status-icon ${extraClass}"></i>`;
  }

  let editedHtml = message.isEdited ? '<span class="edited-tag">(edited)</span>' : '';

  messageElement.innerHTML = `
    <div class="missive ${isSender ? "sender-message" : "receiver-message"}">
      ${contentHtml}
      <div class="message-meta">
        ${editedHtml}
        <h5>${time}</h5>
        ${statusHtml}
      </div>
    </div>
  `;

  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function showGroupMessage(message) {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  const currentUser = localStorage.getItem("username");
  const senderName = message.sender && message.sender.username ? message.sender.username : (typeof message.sender === 'string' ? message.sender : '');
  const isSender = senderName === currentUser;

  // Dedup: skip WebSocket echo of messages the sender already rendered locally
  // Match on sender + message content within a 5-second window
  if (isSender) {
    const key = `${senderName}|${message.message}`;
    const now = Date.now();
    if (!window._groupMsgDedup) window._groupMsgDedup = {};
    if (window._groupMsgDedup[key] && now - window._groupMsgDedup[key] < 5000) {
      // This is a duplicate echo — skip it
      delete window._groupMsgDedup[key];
      return;
    }
    window._groupMsgDedup[key] = now;
  }

  const messageElement = document.createElement("div");
  messageElement.classList.add(
    isSender ? "message-contents-sender" : "message-contents-receiver"
  );

  const time = message.time ? new Date(message.time).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  }) : '';

  let statusHtml = '';
  if (isSender && message.id) {
    statusHtml += `
      <div class="msg-dropdown-container">
        <button class="msg-options-btn" onclick="window.toggleMessageMenu(event, ${message.id})"><i class="fa fa-ellipsis-v"></i></button>
        <div class="msg-dropdown-menu" id="msg-menu-${message.id}">
          <div class="msg-dropdown-item" onclick="window.editMessageFrontend(${message.id}, this)">
            <i class="fa fa-pencil"></i> Edit
          </div>
          <div class="msg-dropdown-item delete" onclick="window.deleteMessageFrontend(${message.id}, this)">
            <i class="fa fa-trash"></i> Delete
          </div>
        </div>
      </div>
    `;
  }

  let editedHtml = message.isEdited ? '<span class="edited-tag">(edited)</span>' : '';

  messageElement.innerHTML = `
    <div class="missive ${isSender ? "sender-message" : "receiver-message"}">
      ${!isSender ? `<h6 class="group-sender-name">${sanitize(senderName)}</h6>` : ''}
      <h6>${sanitize(message.message)}</h6>
      <div class="message-meta">
        ${editedHtml}
        <h5>${time}</h5>
        ${statusHtml}
      </div>
    </div>
  `;

  chatContainer.appendChild(messageElement);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

export function clearChatDisplay() {
  const chatContainer = document.getElementById("chat-container");
  if (chatContainer) {
    chatContainer.innerHTML = "";
  }
}

export function populateUserProfile() {
  const profileImage = document.querySelector('.profile-image-con img');
  const profileName = document.querySelector('.profile-name-details h3');
  const chatHeadImage = document.querySelector('#chek-now');
  const aboutText = document.getElementById('about-text');

  const username = localStorage.getItem('username');
  const firstname = localStorage.getItem('firstname');
  const lastname = localStorage.getItem('lastname');
  const profilePicture = localStorage.getItem('profilePicture');
  const about = localStorage.getItem('about');

  if (profilePicture) {
    if (profileImage) profileImage.src = profilePicture;
    if (chatHeadImage) chatHeadImage.src = profilePicture;
  }

  const fullName = firstname && lastname && username
    ? `${firstname} ${lastname} ${username}`
    : username;
  if (profileName) profileName.textContent = fullName;

  // Populate about section
  if (aboutText) {
    aboutText.textContent = about || 'Hey there! I am using ChatApp.';
  }
}

export function updateReceiverDetails(receiver) {
  const receiverImage = document.querySelector('.message-head .friend-details img');
  const receiverName = document.querySelector('.friend-contact h3');
  const receiverPhone = document.querySelector('.friend-contact h4');

  const modalImage = document.querySelector('.message-image-details img');
  const modalName = document.querySelector('.message-image-details h3');
  const modalPhone = document.querySelector('.message-image-details h4');
  const modalAbout = document.querySelector('.message-description h4');

  let profilePicture = receiver.profilePicture || '';
  profilePicture = profilePicture.replace(/['"]/g, '').trim();

  if (profilePicture && !profilePicture.startsWith('http')) {
    profilePicture = `${BASE_URL}/uploads/${profilePicture}`;
  }

  if (receiverImage) {
    if (receiver.username === "AI Assistant") {
      receiverImage.src = "https://cdn-icons-png.flaticon.com/512/4712/4712035.png";
    } else {
      receiverImage.src = profilePicture || '../chat-images/1.jpeg';
    }
    receiverImage.style.display = '';
    receiverImage.onerror = () => {
      receiverImage.src = receiver.username === "AI Assistant" ? "https://cdn-icons-png.flaticon.com/512/4712/4712035.png" : '../chat-images/1.jpeg';
    };
  }

  // Hide video/audio call buttons for AI Assistant
  const callButtons = document.querySelector('.friend-name');
  if (callButtons) {
    callButtons.style.visibility = (receiver.username === "AI Assistant") ? 'hidden' : 'visible';
  }

  if (receiverName) {
    receiverName.textContent = receiver.username || 'Unknown User';
  }

  if (receiverPhone) {
    receiverPhone.textContent = receiver.phoneNumber || 'No phone number';
  }

  if (modalImage) {
    if (receiver.username === "AI Assistant") {
      modalImage.src = "https://cdn-icons-png.flaticon.com/512/4712/4712035.png";
    } else {
      modalImage.src = profilePicture || '../chat-images/1.jpeg';
    }
    modalImage.onerror = () => {
      modalImage.src = receiver.username === "AI Assistant" ? "https://cdn-icons-png.flaticon.com/512/4712/4712035.png" : '../chat-images/1.jpeg';
    };
  }

  if (modalName) {
    modalName.textContent = receiver.username || 'Unknown User';
  }

  if (modalPhone) {
    modalPhone.textContent = receiver.phoneNumber || 'No phone number';
  }

  if (modalAbout) {
    modalAbout.textContent = receiver.about || 'Hey there! I am using ChatApp.';
  }
}

export function filterDuplicateUsers(users) {
  const uniqueUsers = [];
  const usernames = new Set();

  users.forEach(user => {
    if (!usernames.has(user.username)) {
      usernames.add(user.username);
      uniqueUsers.push(user);
    }
  });

  return uniqueUsers;
}

export function clearSearchResults() {
  if (searchResultContainer) {
    searchResultContainer.innerHTML = "";
    searchResultContainer.style.display = "none";
  }
}

export function focusMessageInput() {
  const chatMessageContainer = document.querySelector(".message-foot");
  if (!chatMessageContainer) return;

  chatMessageContainer.scrollIntoView({ behavior: "smooth" });

  const inputBox = document.querySelector("#send-message");
  if (inputBox) {
    inputBox.focus();
  }
}

window.deleteMessageFrontend = async function (messageId, element) {
  if (!confirm("Are you sure you want to delete this message?")) return;
  try {
    const icon = element.querySelector('i');
    if (icon) icon.className = "fa fa-spinner fa-spin";
    element.style.color = "#ccc";
    await deleteMessage(messageId);

    // Attempt to find the full message container
    // Either it's a direct child of .missive or higher up
    const messageDiv = element.closest(".message-contents-sender");
    if (messageDiv) messageDiv.remove();
  } catch (error) {
    console.error("Delete failed:", error);
    const icon = element.querySelector('i');
    if (icon) icon.className = "fa fa-trash";
    element.style.color = "red";
    alert("Failed to delete message: " + error.message);
  }
};

window.toggleMessageMenu = function (event, messageId) {
  event.stopPropagation();
  const container = event.currentTarget.closest('.msg-dropdown-container');

  // Close all other open windows
  document.querySelectorAll('.msg-dropdown-container.show').forEach(el => {
    if (el !== container) el.classList.remove('show');
  });

  if (container) {
    container.classList.toggle('show');
  }
};

// Close menus when clicking anywhere else
document.addEventListener('click', function (e) {
  if (!e.target.closest('.msg-dropdown-container')) {
    document.querySelectorAll('.msg-dropdown-container.show').forEach(el => {
      el.classList.remove('show');
    });
  }
});

// Used to store what message we're currently editing
window.currentEditingMessageId = null;

window.editMessageFrontend = function (messageId, element) {
  // 1. Find the message text block
  const messageDiv = element.closest(".message-contents-sender");
  if (!messageDiv) return;

  const h6 = messageDiv.querySelector('h6');
  if (!h6) return;

  const currentText = h6.innerText;

  // 2. Put it in the chat box
  const inputBox = document.querySelector("#send-message");
  if (inputBox) {
    inputBox.value = currentText;
    inputBox.focus();

    // Change the send button icon to an edit/update icon
    const submitBtn = document.querySelector("#submit");
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa fa-check"></i>';
      submitBtn.style.background = '#10b981'; // green to indicate edit mode
    }

    window.currentEditingMessageId = messageId;
  }

  // Close menu
  const container = element.closest('.msg-dropdown-container');
  if (container) container.classList.remove('show');
};
