import { BASE_URL } from './config.js';
import { searchUsersByName, logout, fetchPreviousConversations, getMyGroups, getGroupMessages, getOnlineUsers } from "./apiService";
import { showMessage, showGroupMessage, clearChatDisplay, focusMessageInput, updateReceiverDetails, clearSearchResults, filterDuplicateUsers } from "./utils";
import { subscribeToGroup, sendReadReceipt } from "./webSocket";

const AI_ASSISTANT = {
  username: "AI Assistant",
  profilePicture: "../chat-images/ai-icon.png", // We'll need to ensure this exists or use a fallback
  about: "Your AI powered assistant."
};

// ── Presence tracking ────────────────────────────────────────────────────
let onlineUsers = new Set();

async function loadOnlineUsers() {
  try {
    const users = await getOnlineUsers();
    onlineUsers = new Set(users);
    onlineUsers.forEach(username => updatePresenceDot(username, 'ONLINE'));
  } catch (e) { console.warn('Could not load online users:', e); }
}

// Called from chatPage.js when a presence WebSocket message arrives
export function updatePresenceDot(username, status) {
  const isOnline = status === 'ONLINE';
  if (isOnline) {
    onlineUsers.add(username);
  } else {
    onlineUsers.delete(username);
  }

  // Update all dots for this user in the chat list
  const dots = document.querySelectorAll(`.presence-dot[data-user="${username}"]`);
  dots.forEach(dot => {
    dot.classList.toggle('online', isOnline);
    dot.classList.toggle('offline', !isOnline);
    dot.title = isOnline ? 'Online' : 'Offline';
  });

  // Update the friend status line in the header if this user is the current receiver
  const friendPhone = document.querySelector('.friend-contact h4');
  const receiver = localStorage.getItem('currentReceiver');
  if (friendPhone && receiver === username) {
    friendPhone.textContent = isOnline ? '🟢 Online' : '';
  }
}

const searchResultContainer = document.getElementById("search-results-container");
const searchInput = document.getElementById("auto-search-user");

let currentReceiver = localStorage.getItem('currentReceiver') || null;
let currentGroup = null;

function debounce(func, delay) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

if (searchInput) {
  searchInput.addEventListener("keyup", debounce(searchUser, 400));
}

// ── Unread message counts ─────────────────────────────────────────────────
let unreadCounts = {};
try {
  unreadCounts = JSON.parse(localStorage.getItem('unreadCounts') || '{}');
} catch (_) { unreadCounts = {}; }

function saveUnreadCounts() {
  localStorage.setItem('unreadCounts', JSON.stringify(unreadCounts));
}

export function incrementUnread(sender) {
  unreadCounts[sender] = (unreadCounts[sender] || 0) + 1;
  saveUnreadCounts();
  const badge = document.querySelector(`.unread-badge[data-user="${sender}"]`);
  if (badge) {
    badge.textContent = unreadCounts[sender];
    badge.style.display = 'flex';
  }
}

export function clearUnread(sender) {
  if (!sender) return;
  delete unreadCounts[sender];
  saveUnreadCounts();
  const badge = document.querySelector(`.unread-badge[data-user="${sender}"]`);
  if (badge) {
    badge.textContent = '0';
    badge.style.display = 'none';
  }
}


export function initializeChatList() {
  const selectedChats = getSelectedChats();
  if (selectedChats.length > 0) {
    displaySearchResults(selectedChats);

    const currentReceiver = getCurrentReceiver();
    if (currentReceiver) {
      const receiver = selectedChats.find(u => u.username === currentReceiver);
      if (receiver) {
        updateReceiverDetails(receiver);

        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        if (!isMobile) {
          updatePreviousConversation();
        }
      }
    }
  }

  // Refresh cached user data (profile pictures, about, etc.) from the server
  refreshSelectedChatsFromServer();
  // Load presence data
  loadOnlineUsers();
}

export async function initializeGroupList() {
  const groupListContainer = document.getElementById("group-list-container");
  if (!groupListContainer) return;

  groupListContainer.innerHTML = "<p class='loading'>Loading groups...</p>";

  try {
    const groups = await getMyGroups();
    groupListContainer.innerHTML = "";

    if (groups.length === 0) {
      groupListContainer.innerHTML = "<p class='empty-message'>No groups yet. Create one!</p>";
      return;
    }

    groups.forEach(group => {
      const groupLink = createGroupLink(group);
      groupListContainer.appendChild(groupLink);

      // Subscribe to each group's WebSocket topic.
      // Each subscription is already scoped to /topic/group-{id} so we just
      // check whether this group is the one currently open before rendering.
      subscribeToGroup(group.id, (message) => {
        if (currentGroup && Number(currentGroup.id) === Number(message.groupId)) {
          showGroupMessage(message);
        }
      });
    });
  } catch (error) {
    console.error("Error loading groups:", error);
    groupListContainer.innerHTML = "<p class='error'>Failed to load groups.</p>";
  }
}

function createGroupLink(group) {
  const groupLink = document.createElement("a");
  groupLink.href = "#";
  groupLink.classList.add("chat-link", "group-link");

  if (currentGroup && currentGroup.id === group.id) {
    groupLink.classList.add("active-chat");
  }

  const chatDesc = document.createElement("div");
  chatDesc.classList.add("chat-desc");

  const imageDiv = document.createElement("div");
  imageDiv.classList.add("image");

  const groupIcon = document.createElement("div");
  groupIcon.classList.add("group-icon");
  groupIcon.innerHTML = '<i class="fa fa-users"></i>';
  imageDiv.appendChild(groupIcon);

  const nameDiv = document.createElement("div");
  nameDiv.classList.add("name");

  const groupName = document.createElement("h3");
  groupName.textContent = group.name;

  const memberCount = document.createElement("h4");
  memberCount.textContent = `${group.members ? group.members.length : 0} members`;

  nameDiv.appendChild(groupName);
  nameDiv.appendChild(memberCount);

  chatDesc.appendChild(imageDiv);
  chatDesc.appendChild(nameDiv);

  const timeDiv = document.createElement("div");
  timeDiv.classList.add("time");

  const adminBadge = document.createElement("span");
  const currentUser = localStorage.getItem("username");
  if (group.admin && group.admin.username === currentUser) {
    adminBadge.classList.add("admin-badge");
    adminBadge.textContent = "Admin";
  }
  timeDiv.appendChild(adminBadge);

  groupLink.appendChild(chatDesc);
  groupLink.appendChild(timeDiv);

  groupLink.addEventListener("click", (event) => {
    event.preventDefault();
    selectGroup(group);
    focusMessageInput();
  });

  return groupLink;
}

async function selectGroup(group) {
  clearChatDisplay();
  currentGroup = group;
  currentReceiver = null;
  localStorage.removeItem('currentReceiver');

  // Update receiver header with group info
  const receiverImage = document.querySelector('.message-head .friend-details img');
  const receiverName = document.querySelector('.friend-contact h3');
  const receiverPhone = document.querySelector('.friend-contact h4');

  if (receiverImage) {
    receiverImage.style.display = 'none';
  }

  if (receiverName) {
    receiverName.textContent = group.name;
  }

  if (receiverPhone) {
    receiverPhone.textContent = `${group.members ? group.members.length : 0} members`;
  }

  // Mark active group
  document.querySelectorAll(".group-link").forEach(link => {
    link.classList.remove("active-chat");
  });

  toggleMobileViews();

  // Load group messages
  await loadGroupMessages(group.id);
}

async function loadGroupMessages(groupId) {
  const chatContainer = document.getElementById("chat-container");
  if (!chatContainer) return;

  chatContainer.innerHTML = "<div class='loading'>Loading messages...</div>";

  try {
    const messages = await getGroupMessages(groupId);
    chatContainer.innerHTML = "";

    if (messages.length === 0) {
      return;
    }

    messages.forEach(msg => {
      showGroupMessage(msg);
    });

  } catch (error) {
    console.error("Error loading group messages:", error);
    chatContainer.innerHTML = "<div class='error'>Failed to load messages.</div>";
  }
}

export function getCurrentGroup() {
  return currentGroup;
}

export function setCurrentGroup(group) {
  currentGroup = group;
}

export function initializeReceiver() {
  currentReceiver = localStorage.getItem('currentReceiver');
  const receiverData = localStorage.getItem("currentReceiverData");

  if (receiverData) {
    updateReceiverDetails(JSON.parse(receiverData));
  }
}

export function initializeBackBtn() {
  const backButton = document.querySelector('.back-to-search');
  if (backButton) {
    backButton.addEventListener('click', () => {
      const searchContainer = document.querySelector('.chat-description-container');
      const chatContainer = document.querySelector('.chat-messages-container');

      if (searchContainer && chatContainer) {
        searchContainer.classList.remove('hidden');
        chatContainer.classList.remove('active');
      }
    });
  }
}

async function searchUser() {
  const query = searchInput.value.trim();

  try {
    if (query.length >= 2) {
      const users = await searchUsersByName(query);
      const uniqueUsers = filterDuplicateUsers(users);
      displaySearchResults(uniqueUsers);
    } else {
      clearSearchResults();
    }
  } catch (error) {
    console.error("Error fetching user:", error);
    searchResultContainer.innerHTML = "<p>Error fetching users. Please try again later.</p>";
    searchResultContainer.style.display = "block";
  }
}

function displaySearchResults(users) {
  clearSearchResults();
  const selectedChats = getSelectedChats();

  const allUsers = [AI_ASSISTANT, ...selectedChats, ...users].reduce((acc, user) => {
    if (!acc.some(u => u.username === user.username)) {
      acc.push(user);
    }
    return acc;
  }, []);

  if (allUsers.length === 0) {
    searchResultContainer.innerHTML = "<p>No users found</p>";
    searchResultContainer.style.display = "block";
    return;
  }

  allUsers.forEach((user) => {
    const chatLink = createChatLink(user);

    if (user.username === currentReceiver) {
      chatLink.classList.add('active-chat');
    }

    searchResultContainer.appendChild(chatLink);

    chatLink.addEventListener("click", (event) => {
      event.preventDefault();
      currentGroup = null; // Clear group selection when selecting a user
      setCurrentReceiver(user);
      focusMessageInput();
    });
  });

  searchResultContainer.style.display = "block";
}

export function getCurrentReceiver() {
  const storedReceiver = localStorage.getItem('currentReceiver');
  if (storedReceiver !== currentReceiver) {
    currentReceiver = storedReceiver;
  }
  return currentReceiver;
}

async function setCurrentReceiver(user) {
  clearChatDisplay();
  currentReceiver = user.username;

  if (!currentReceiver) {
    console.error("Invalid username provided to setCurrentReceiver");
    return;
  }

  localStorage.setItem("currentReceiverData", JSON.stringify(user));
  localStorage.setItem('currentReceiver', currentReceiver);

  // Show receiver image again (hidden when group was selected)
  const receiverImage = document.querySelector('.message-head .friend-details img');
  if (receiverImage) {
    receiverImage.style.display = '';
  }

  addSelectedChat(user);
  updateReceiverDetails(user);
  clearUnread(user.username); // ← clear badge when conversation is opened
  toggleMobileViews();

  // Send read receipt for messages from this user before loading
  const token = localStorage.getItem("token");
  const currentUser = localStorage.getItem("username");
  if (token && currentUser) {
    sendReadReceipt(user.username, currentUser, token);
  }

  await updatePreviousConversation();
}

function toggleMobileViews() {
  const isMobile = window.matchMedia("(max-width: 768px)").matches;

  if (isMobile) {
    const searchContainer = document.querySelector('.chat-description-container');
    const chatContainer = document.querySelector('.chat-messages-container');

    if (searchContainer && chatContainer) {
      searchContainer.classList.add('hidden');
      chatContainer.classList.add('active');
    }
  }
}

export async function updatePreviousConversation() {
  try {
    const chatContainer = document.getElementById("chat-container");
    if (!chatContainer) return;

    chatContainer.innerHTML = "<div class='loading'>Loading messages...</div>";

    const sender = localStorage.getItem("username");
    const receiver = getCurrentReceiver();

    if (!sender || !receiver) {
      chatContainer.innerHTML = "<div class='empty'>Select a user to view messages</div>";
      return;
    }

    const conversations = await fetchPreviousConversations(sender, receiver);
    chatContainer.innerHTML = "";

    if (conversations.length === 0) {
      return;
    }

    conversations.sort((a, b) => new Date(a.time) - new Date(b.time));

    conversations.forEach(message => {
      showMessage({
        sender: message.sender,
        receiver: message.receiver,
        message: message.message,
        time: message.time,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileType: message.fileType,
        status: message.status
      });
    });

  } catch (error) {
    console.error("Error loading previous conversations:", error);
    const chatContainer = document.getElementById("chat-container");
    if (chatContainer) {
      chatContainer.innerHTML = "<div class='error'>Failed to load messages. Please try again.</div>";
    }
  }
}

function addSelectedChat(user) {
  const chats = getSelectedChats();
  const existingIndex = chats.findIndex(chat => chat.username === user.username);

  if (existingIndex === -1) {
    chats.push(user);
  } else {
    // Always update cached user data with latest info (profile picture, about, etc.)
    chats[existingIndex] = { ...chats[existingIndex], ...user };
  }
  localStorage.setItem('selectedChats', JSON.stringify(chats));
}

function getSelectedChats() {
  const chats = localStorage.getItem('selectedChats');
  return chats ? JSON.parse(chats) : [];
}

async function refreshSelectedChatsFromServer() {
  const chats = getSelectedChats();
  if (chats.length === 0) return;

  let updated = false;

  for (const cachedUser of chats) {
    try {
      const users = await searchUsersByName(cachedUser.username);
      const freshUser = users.find(u => u.username === cachedUser.username);

      if (freshUser) {
        // Check if profile picture or other details changed
        if (freshUser.profilePicture !== cachedUser.profilePicture ||
          freshUser.about !== cachedUser.about ||
          freshUser.phoneNumber !== cachedUser.phoneNumber) {
          // Update cache with fresh data
          Object.assign(cachedUser, freshUser);
          updated = true;
        }
      }
    } catch (error) {
      console.error(`Failed to refresh data for ${cachedUser.username}:`, error);
    }
  }

  if (updated) {
    localStorage.setItem('selectedChats', JSON.stringify(chats));
    // Re-render the chat list with updated data
    displaySearchResults(chats);

    // Also update the currently selected receiver's details if they changed
    const currentRcvr = getCurrentReceiver();
    if (currentRcvr) {
      const updatedReceiver = chats.find(u => u.username === currentRcvr);
      if (updatedReceiver) {
        localStorage.setItem('currentReceiverData', JSON.stringify(updatedReceiver));
        updateReceiverDetails(updatedReceiver);
      }
    }
  }
}

function createChatLink(user) {
  const chatLink = document.createElement("a");
  chatLink.href = "#";
  chatLink.classList.add("chat-link");

  const chatDesc = document.createElement("div");
  chatDesc.classList.add("chat-desc");

  const imageDiv = document.createElement("div");
  imageDiv.classList.add("image", "presence-wrapper");

  const userImage = document.createElement("img");

  if (userImage) {
    let profilePicture = user.profilePicture;
    if (user.username === "AI Assistant") {
      profilePicture = "../chat-images/ai-icon.png";
    } else {
      profilePicture = profilePicture ? profilePicture.replace(/['"]/g, '').trim() : '';
      if (profilePicture && !profilePicture.startsWith('http')) {
        profilePicture = `${BASE_URL}/uploads/${profilePicture}`;
      }
    }
    userImage.src = profilePicture || '../chat-images/1.jpeg';
    userImage.onerror = () => {
      userImage.src = user.username === "AI Assistant" ? "https://cdn-icons-png.flaticon.com/512/4712/4712035.png" : '../chat-images/1.jpeg';
    };
  }

  userImage.alt = `${user.username}'s profile picture`;
  imageDiv.appendChild(userImage);

  // ── Presence dot ─────────────────
  const dot = document.createElement("span");
  dot.classList.add("presence-dot");
  dot.setAttribute("data-user", user.username);
  const isOnline = onlineUsers.has(user.username);
  dot.classList.add(isOnline ? 'online' : 'offline');
  dot.title = isOnline ? 'Online' : 'Offline';
  imageDiv.appendChild(dot);

  const nameDiv = document.createElement("div");
  nameDiv.classList.add("name");

  const userName = document.createElement("h3");
  userName.textContent = user.username;

  nameDiv.appendChild(userName);
  chatDesc.appendChild(imageDiv);
  chatDesc.appendChild(nameDiv);

  const timeDiv = document.createElement("div");
  timeDiv.classList.add("time");

  // ── Unread badge ──────────────────
  const count = unreadCounts[user.username] || 0;
  const badge = document.createElement("span");
  badge.classList.add("unread-badge");
  badge.setAttribute("data-user", user.username);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
  timeDiv.appendChild(badge);

  const volumeIcon = document.createElement("i");
  volumeIcon.classList.add("fa", "fa-volume-up");
  volumeIcon.setAttribute("aria-hidden", "true");
  timeDiv.appendChild(volumeIcon);

  chatLink.appendChild(chatDesc);
  chatLink.appendChild(timeDiv);

  return chatLink;
}

export async function addSenderToSearchResult(senderUserName) {
  try {
    const users = await searchUsersByName(senderUserName);
    const sender = users.find((user) => user.username === senderUserName);

    if (!sender) {
      console.log("Sender not found in search result");
      return;
    }

    const existingUser = Array.from(document.querySelectorAll(".chat-link"))
      .find(link => link.querySelector("h3").textContent === sender.username);

    if (!existingUser) {
      displaySearchResults([sender]);
    }
  } catch (error) {
    console.error("Error fetching sender details:", error);
  }
}

export async function logoutUser() {
  const logoutBtn = document.querySelector(".logout-btn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        logoutBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Logging out...';
        logoutBtn.disabled = true;

        await logout();
        localStorage.clear();
        window.location.href = "login.html";

      } catch (error) {
        console.error("Logout failed:", error);
        alert("Logout failed. Please try again.");

        logoutBtn.innerHTML = '<i class="fa fa-sign-out"></i> Logout';
        logoutBtn.disabled = false;
      }
    });
  }
}