import { BASE_URL } from './config.js';
import {
  connectToWebSocketAndReceiveMessages,
  sendMessages,
  subscribeToGroup,
  sendGroupMessage,
  sendVideoCallSignal,
  sendTypingStatus,
  sendReadReceipt
} from './webSocket';

import {
  addSenderToSearchResult,
  getCurrentReceiver,
  initializeReceiver,
  logoutUser,
  initializeChatList,
  initializeBackBtn,
  initializeGroupList,
  getCurrentGroup,
  setCurrentGroup,
  updatePresenceDot,
  incrementUnread,
  updatePreviousConversation
} from './userService';

import {
  showMessage,
  showGroupMessage,
  populateUserProfile,
  focusMessageInput,
  displayErrorMessages,
  clearChatDisplay
} from './utils';

import {
  updateProfilePicture,
  updateAbout,
  createGroup,
  searchUsersByName,
  getGroupMessages,
  uploadChatFile,
  editMessageApi,
  clearChatApi
} from './apiService';

// ── State ──────────────────────────────────────────────────────────────
let currentMode = 'chats';
let pendingFileAttachment = null; // { fileUrl, fileName, fileType }
let typingTimer = null;
let isCurrentlyTyping = false;

// ── Bootstrap ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const currentUser = localStorage.getItem('username');
  const token = localStorage.getItem('token');

  if (!currentUser || !token) {
    window.location.href = 'login.html';
    return;
  }

  initializeApplication();
  setupWebSocketConnection(currentUser, token);
  setupEventListeners(currentUser, token);
  setupAboutEditing();
  setupGroupFeatures(currentUser);
  setupVideoCallFeatures(currentUser, token);
  setupFileSharing(currentUser, token);
  setupTypingIndicator(currentUser, token);

  // ── Init ──────────────────────────────────────────────────────────
  function initializeApplication() {
    populateUserProfile();
    initializeReceiver();
    initializeChatList();
    initializeBackBtn();
    logoutUser();
  }

  // ── WebSocket ─────────────────────────────────────────────────────
  function setupWebSocketConnection(user, tok) {
    connectToWebSocketAndReceiveMessages(
      user,
      tok,
      handleIncomingMessage,
      handleIncomingVideoSignal,
      handleTypingStatus,
      handleReadReceipt,
      (presence) => updatePresenceDot(presence.username, presence.status)
    );
  }

  // ── Event listeners ───────────────────────────────────────────────
  function setupEventListeners(user, tok) {
    const messageForm = document.querySelector('.message-foot form');
    const messageInput = document.getElementById('send-message');
    const profileImageCon = document.querySelector('.profile-image-con');
    const profilePicInput = document.getElementById('profile-pic-input');
    const chatsTab = document.getElementById('chats-tab');
    const groupsTab = document.getElementById('groups-tab');

    if (messageForm) {
      messageForm.addEventListener('submit', (e) => {
        e.preventDefault();
        currentMode === 'groups' ? sendGroupMsg() : sendMsg();
      });
    }

    if (messageInput) {
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          currentMode === 'groups' ? sendGroupMsg() : sendMsg();
        }
      });
    }

    // Profile picture upload
    if (profileImageCon && profilePicInput) {
      profileImageCon.addEventListener('click', () => profilePicInput.click());

      profilePicInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (!file.type.match('image.*')) { alert('Please select an image file'); return; }

        const formData = new FormData();
        formData.append('profilePicture', file);

        try {
          const response = await updateProfilePicture(formData);
          let newPic = String(response.data || '').replace(/['"]/g, '').trim();
          if (newPic && !newPic.startsWith('http')) newPic = `${BASE_URL}/uploads/${newPic}`;
          if (newPic) {
            localStorage.setItem('profilePicture', newPic);
            populateUserProfile();
            alert('Profile picture updated successfully!');
          }
        } catch (err) {
          console.error('Profile pic update failed:', err);
          alert(`Failed to update profile picture: ${err.message}`);
        }
      });
    }

    // Custom event to reload messages when cleared/edited
    window.addEventListener('reload-messages', async () => {
      const receiver = getCurrentReceiver();
      if (!receiver) return;
      try {
        await updatePreviousConversation();
      } catch (e) {
        console.error('Failed to reload messages via WS event', e);
      }
    });

    // Tab switching
    if (chatsTab) chatsTab.addEventListener('click', () => switchTab('chats'));
    if (groupsTab) groupsTab.addEventListener('click', () => switchTab('groups'));

    // Clear Chat
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', async () => {
        const receiver = getCurrentReceiver();
        if (!receiver) return;

        if (!confirm(`Are you sure you want to clear your entire conversation with ${receiver}? This cannot be undone.`)) return;

        try {
          await clearChatApi(receiver);
          // If successful, empty the chat container and close the menu
          const chatContainer = document.getElementById("chat-container");
          if (chatContainer) chatContainer.innerHTML = '';
          const menu = document.getElementById('chat-menu');
          if (menu) menu.classList.remove('show');
        } catch (err) {
          alert('Failed to clear chat: ' + err.message);
        }
      });
    }
  }

  function switchTab(mode) {
    currentMode = mode;
    const chatsTab = document.getElementById('chats-tab');
    const groupsTab = document.getElementById('groups-tab');
    const searchContainer = document.getElementById('search-results-container');
    const groupListContainer = document.getElementById('group-list-container');
    const createGroupBtn = document.getElementById('create-group-btn');

    if (chatsTab) chatsTab.classList.toggle('active-tab', mode === 'chats');
    if (groupsTab) groupsTab.classList.toggle('active-tab', mode === 'groups');

    if (mode === 'chats') {
      if (searchContainer) searchContainer.style.display = 'block';
      if (groupListContainer) groupListContainer.style.display = 'none';
      if (createGroupBtn) createGroupBtn.style.display = 'none';
      initializeChatList();
    } else {
      if (searchContainer) searchContainer.style.display = 'none';
      if (groupListContainer) groupListContainer.style.display = 'block';
      if (createGroupBtn) createGroupBtn.style.display = 'block';
      initializeGroupList();
    }
  }

  // ── About editing ─────────────────────────────────────────────────
  function setupAboutEditing() {
    const aboutEditBtn = document.getElementById('edit-about-btn');
    const aboutText = document.getElementById('about-text');

    if (aboutEditBtn && aboutText) {
      aboutEditBtn.addEventListener('click', async () => {
        const current = localStorage.getItem('about') || '';
        const newAbout = prompt('Update your About section:', current);

        if (newAbout !== null && newAbout !== current) {
          try {
            await updateAbout(newAbout);
            localStorage.setItem('about', newAbout);
            aboutText.textContent = newAbout || 'Hey there! I am using ChatApp.';
          } catch (err) {
            alert(`Failed to update about: ${err.message}`);
          }
        }
      });
    }
  }

  // ── Group features ────────────────────────────────────────────────
  function setupGroupFeatures(user) {
    const createGroupBtn = document.getElementById('create-group-btn');
    const modal = document.getElementById('create-group-modal');
    const closeBtn = document.getElementById('close-group-modal');
    const submitBtn = document.getElementById('submit-group-btn');
    const memberSearch = document.getElementById('group-member-search');
    const memberResults = document.getElementById('group-member-results');

    let selectedMembers = new Set();

    if (createGroupBtn && modal) {
      createGroupBtn.addEventListener('click', () => {
        modal.style.display = 'flex';
        selectedMembers.clear();
        updateSelectedMembersUI();
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    // Click outside to close
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });
    }

    if (memberSearch) {
      let timeout;
      memberSearch.addEventListener('keyup', () => {
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          const q = memberSearch.value.trim();
          if (q.length >= 2) {
            try {
              const users = await searchUsersByName(q);
              renderMemberResults(users.filter(u => u.username !== user), selectedMembers, memberResults);
            } catch (err) { console.error(err); }
          } else if (memberResults) {
            memberResults.innerHTML = '';
          }
        }, 400);
      });
    }

    if (submitBtn) {
      submitBtn.addEventListener('click', async () => {
        const nameInput = document.getElementById('group-name-input');
        const groupName = nameInput ? nameInput.value.trim() : '';

        if (!groupName) { alert('Please enter a group name'); return; }
        if (selectedMembers.size === 0) { alert('Please add at least one member'); return; }

        try {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Creating...';
          await createGroup(groupName, Array.from(selectedMembers));
          modal.style.display = 'none';
          if (nameInput) nameInput.value = '';
          selectedMembers.clear();
          alert('Group created!');
          initializeGroupList();
        } catch (err) {
          alert(`Failed to create group: ${err.message}`);
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Group';
        }
      });
    }

    function renderMemberResults(users, selected, container) {
      if (!container) return;
      container.innerHTML = '';
      users.forEach(u => {
        const div = document.createElement('div');
        div.classList.add('member-search-item');
        const isSel = selected.has(u.username);
        div.innerHTML = `<span>${u.username}</span><button class="member-toggle-btn ${isSel ? 'selected' : ''}">${isSel ? '✓' : '+'}</button>`;
        div.querySelector('button').addEventListener('click', () => {
          isSel ? selected.delete(u.username) : selected.add(u.username);
          renderMemberResults(users, selected, container);
          updateSelectedMembersUI();
        });
        container.appendChild(div);
      });
    }

    function updateSelectedMembersUI() {
      const sel = document.getElementById('selected-members');
      if (!sel) return;
      sel.innerHTML = '';
      selectedMembers.forEach(username => {
        const badge = document.createElement('span');
        badge.classList.add('member-badge');
        badge.innerHTML = `${username} <button class="remove-member">×</button>`;
        badge.querySelector('button').addEventListener('click', () => {
          selectedMembers.delete(username);
          updateSelectedMembersUI();
        });
        sel.appendChild(badge);
      });
    }
  }

  // ── File sharing ──────────────────────────────────────────────────
  function setupFileSharing(user, tok) {
    const attachBtn = document.getElementById('attach-file-outer-btn');
    const fileInput = document.getElementById('chat-file-input');
    const attachPreview = document.getElementById('attach-preview');
    const attachName = document.getElementById('attach-name');
    const removeAttach = document.getElementById('remove-attach');

    if (attachBtn && fileInput) {
      attachBtn.addEventListener('click', (e) => {
        e.preventDefault();
        fileInput.click();
      });

      fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (attachPreview) attachPreview.style.display = 'flex';
        if (attachName) attachName.textContent = `Uploading ${file.name}...`;

        try {
          const formData = new FormData();
          formData.append('file', file);
          const result = await uploadChatFile(formData);

          // Resolve to a full URL
          let fileUrl = result.fileUrl || '';
          if (fileUrl && !fileUrl.startsWith('http')) {
            fileUrl = `${BASE_URL}/uploads/${fileUrl}`;
          }

          pendingFileAttachment = {
            fileUrl,
            fileName: result.fileName,
            fileType: result.fileType
          };

          if (attachName) attachName.textContent = result.fileName;
          console.log('✅ File uploaded:', pendingFileAttachment);
        } catch (err) {
          console.error('File upload failed:', err);
          alert(`File upload failed: ${err.message}`);
          pendingFileAttachment = null;
          if (attachPreview) attachPreview.style.display = 'none';
        }

        fileInput.value = '';
      });
    }

    if (removeAttach) {
      removeAttach.addEventListener('click', () => {
        pendingFileAttachment = null;
        if (attachPreview) attachPreview.style.display = 'none';
      });
    }
  }

  // ── Typing indicator ──────────────────────────────────────────────
  function setupTypingIndicator(user, tok) {
    const messageInput = document.getElementById('send-message');

    if (messageInput) {
      messageInput.addEventListener('input', () => {
        const receiver = getCurrentReceiver();
        if (!receiver || currentMode === 'groups') return;

        if (!isCurrentlyTyping) {
          isCurrentlyTyping = true;
          sendTypingStatus(user, receiver, true, tok);
        }

        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          isCurrentlyTyping = false;
          sendTypingStatus(user, receiver, false, tok);
        }, 2000);
      });
    }
  }

  // ── Incoming message handler ──────────────────────────────────────
  function handleIncomingMessage(message) {
    const currentReceiver = getCurrentReceiver();

    // If message is from someone other than active conversation → badge it
    if (message.sender !== currentUser && message.sender !== currentReceiver) {
      incrementUnread(message.sender);
    }

    // Send read receipt if we're currently looking at this conversation
    if (message.sender === currentReceiver) {
      sendReadReceipt(message.sender, currentUser, token);
    }

    if (
      (message.sender === currentUser && message.receiver === currentReceiver) ||
      (message.sender === currentReceiver && message.receiver === currentUser) ||
      (message.receiver === currentUser)
    ) {
      showMessage(message);
    }

    if (message.sender !== currentUser) {
      addSenderToSearchResult(message.sender);
    }
  }

  // ── Typing status handler ─────────────────────────────────────────
  function handleTypingStatus(typing) {
    const indicator = document.getElementById('typing-indicator');
    if (!indicator) return;

    const currentReceiver = getCurrentReceiver();
    if (typing.sender !== currentReceiver) return;

    if (typing.isTyping) {
      indicator.style.display = 'flex';
    } else {
      indicator.style.display = 'none';
    }
  }

  // ── Read receipt handler ──────────────────────────────────────────
  function handleReadReceipt(receipt) {
    // Mark all messages to this user as "READ" checkmarks
    const ticks = document.querySelectorAll('.msg-status[data-receiver="' + receipt.reader + '"]');
    ticks.forEach(el => {
      el.textContent = '✓✓';
      el.style.color = '#60a5fa';
    });
  }

  // ── Video call handler ────────────────────────────────────────────
  function handleIncomingVideoSignal(signal) {
    if (window._handleVideoSignal) {
      window._handleVideoSignal(signal);
    }
  }

  // ── Send 1-on-1 message ───────────────────────────────────────────
  function sendMsg() {
    const receiver = getCurrentReceiver();
    const messageInput = document.getElementById('send-message');
    const content = messageInput ? messageInput.value.trim() : '';

    if (!receiver) { alert('Please select a user to chat with'); return; }

    // ** Edit Mode **
    if (window.currentEditingMessageId) {
      if (!content) { alert('Edited message cannot be empty'); return; }

      editMessageApi(window.currentEditingMessageId, content).then(() => {
        // Success — clean up edit mode
        window.currentEditingMessageId = null;
        if (messageInput) messageInput.value = '';

        const submitBtn = document.querySelector("#submit");
        if (submitBtn) {
          submitBtn.innerHTML = '<i class="fa fa-send-o"></i>';
          submitBtn.style.background = '';
        }
        focusMessageInput();
      }).catch(err => {
        alert("Failed to edit message: " + err.message);
      });

      return; // Prevent normal send
    }

    // ** Normal Send Mode **
    if (!content && !pendingFileAttachment) { alert('Please type a message or attach a file'); return; }

    const fileUrl = pendingFileAttachment ? pendingFileAttachment.fileUrl : null;
    const fileName = pendingFileAttachment ? pendingFileAttachment.fileName : null;
    const fileType = pendingFileAttachment ? pendingFileAttachment.fileType : null;

    const ok = sendMessages(currentUser, receiver, content, token, fileUrl, fileName, fileType);

    if (ok) {
      if (messageInput) messageInput.value = '';

      // Message will be echoed back by WebSocket along with its database ID

      // Clear attachment
      pendingFileAttachment = null;
      const attachPreview = document.getElementById('attach-preview');
      if (attachPreview) attachPreview.style.display = 'none';

      // Clear typing
      if (isCurrentlyTyping) {
        isCurrentlyTyping = false;
        sendTypingStatus(currentUser, receiver, false, token);
        clearTimeout(typingTimer);
      }

      focusMessageInput();
    }
  }

  // ── Send group message ────────────────────────────────────────────
  function sendGroupMsg() {
    const group = getCurrentGroup();
    const messageInput = document.getElementById('send-message');
    const content = messageInput ? messageInput.value.trim() : '';

    if (!group) { alert('Please select a group'); return; }
    if (!content) { alert('Message cannot be empty'); return; }

    const ok = sendGroupMessage(group.id, currentUser, content, token);
    if (ok) {
      if (messageInput) messageInput.value = '';
      // Show locally immediately — sender sees it right away
      showGroupMessage({
        sender: currentUser,
        groupId: group.id,
        message: content,
        time: new Date().toISOString()
      });
      focusMessageInput();
    }
  }

  // ── Video call ────────────────────────────────────────────────────
  function setupVideoCallFeatures(user, tok) {
    let peerConnection = null;
    let localStream = null;

    const videoCallModal = document.getElementById('video-call-modal');
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const endCallBtn = document.getElementById('end-call-btn');
    const acceptCallBtn = document.getElementById('accept-call-btn');
    const rejectCallBtn = document.getElementById('reject-call-btn');
    const incomingOverlay = document.getElementById('incoming-call-overlay');
    const callerNameEl = document.getElementById('caller-name');

    const camBtn = document.getElementById('video-call-btn');
    const phoneBtn = document.getElementById('audio-call-btn');

    console.log('🎥 Video call setup — camBtn:', !!camBtn, 'phoneBtn:', !!phoneBtn);

    if (camBtn) camBtn.addEventListener('click', () => startCall(true));
    if (phoneBtn) phoneBtn.addEventListener('click', () => startCall(false));
    if (endCallBtn) endCallBtn.addEventListener('click', () => endCall(true));
    if (acceptCallBtn) acceptCallBtn.addEventListener('click', acceptCall);
    if (rejectCallBtn) rejectCallBtn.addEventListener('click', rejectCall);

    let pendingOffer = null;
    let pendingCaller = null;

    // This is called from handleIncomingVideoSignal
    window._handleVideoSignal = async (signal) => {
      console.log('📥 Video signal received:', signal.type, 'from:', signal.sender);

      switch (signal.type) {
        case 'offer':
          pendingOffer = signal;
          pendingCaller = signal.sender;
          if (callerNameEl) callerNameEl.textContent = signal.sender;
          if (incomingOverlay) incomingOverlay.style.display = 'flex';
          break;

        case 'answer':
          if (peerConnection) {
            try {
              await peerConnection.setRemoteDescription(
                new RTCSessionDescription({ type: 'answer', sdp: signal.sdp })
              );
              console.log('✅ Remote description (answer) set');
            } catch (e) { console.error('setRemoteDescription error:', e); }
          }
          break;

        case 'candidate':
          if (peerConnection && signal.candidate) {
            try {
              await peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) { console.error('addIceCandidate error:', e); }
          }
          break;

        case 'endCall':
          endCall(false); // don't send endCall back
          break;
      }
    };

    async function startCall(withVideo) {
      const receiver = getCurrentReceiver();
      if (!receiver) { alert('Please select a user to call'); return; }

      console.log('📞 Starting', withVideo ? 'video' : 'audio', 'call with', receiver);

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: withVideo, audio: true });
        if (localVideo) localVideo.srcObject = localStream;
        if (videoCallModal) videoCallModal.style.display = 'flex';

        peerConnection = createPC(receiver);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        sendVideoCallSignal(user, receiver, 'offer', offer.sdp, null, tok);
        console.log('📤 Offer sent to', receiver);
      } catch (err) {
        console.error('startCall error:', err);
        alert('Could not access camera/microphone. Check browser permissions.');
        endCall(false);
      }
    }

    async function acceptCall() {
      if (incomingOverlay) incomingOverlay.style.display = 'none';
      if (!pendingOffer) return;

      console.log('✅ Accepting call from', pendingCaller);

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideo) localVideo.srcObject = localStream;
        if (videoCallModal) videoCallModal.style.display = 'flex';

        peerConnection = createPC(pendingCaller);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: pendingOffer.sdp })
        );

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        sendVideoCallSignal(user, pendingCaller, 'answer', answer.sdp, null, tok);
        console.log('📤 Answer sent to', pendingCaller);
      } catch (err) {
        console.error('acceptCall error:', err);
        endCall(false);
      }
    }

    function rejectCall() {
      if (incomingOverlay) incomingOverlay.style.display = 'none';
      if (pendingCaller) sendVideoCallSignal(user, pendingCaller, 'endCall', null, null, tok);
      pendingOffer = null;
      pendingCaller = null;
    }

    function createPC(remoteUser) {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      });

      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          console.log('🧊 ICE candidate generated');
          sendVideoCallSignal(user, remoteUser, 'candidate', null, candidate.toJSON(), tok);
        }
      };

      pc.ontrack = (e) => {
        console.log('📡 Remote track received');
        if (remoteVideo && e.streams[0]) remoteVideo.srcObject = e.streams[0];
      };

      pc.onconnectionstatechange = () => {
        console.log('🔗 Connection state:', pc.connectionState);
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          endCall(false);
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log('🧊 ICE state:', pc.iceConnectionState);
      };

      return pc;
    }

    function endCall(sendSignal = true) {
      console.log('📵 Ending call, sendSignal:', sendSignal);

      if (peerConnection) { peerConnection.close(); peerConnection = null; }
      if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }

      if (localVideo) localVideo.srcObject = null;
      if (remoteVideo) remoteVideo.srcObject = null;
      if (videoCallModal) videoCallModal.style.display = 'none';
      if (incomingOverlay) incomingOverlay.style.display = 'none';

      pendingOffer = null;
      pendingCaller = null;

      if (sendSignal) {
        const receiver = getCurrentReceiver();
        if (receiver) sendVideoCallSignal(user, receiver, 'endCall', null, null, tok);
      }
    }
  }
});
