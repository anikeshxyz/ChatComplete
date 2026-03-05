import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { BASE_URL } from './config.js';

let stompClient = null;
let activeSubscriptions = new Map();
let reconnectAttempts = 0;
let isConnected = false;

// Queue for group subscriptions requested before WebSocket connects
let pendingGroupSubscriptions = []; // [{groupId, handler}]

export function connectToWebSocketAndReceiveMessages(
  currentUser,
  token,
  handleIncomingMessage,
  handleIncomingVideoSignal,
  handleTypingStatus,
  handleReadReceipt,
  handlePresenceUpdate
) {
  if (stompClient && isConnected) {
    disconnectWebSocket();
  }

  const socket = new SockJS(`${BASE_URL}/chat`);

  stompClient = new Client({
    webSocketFactory: () => socket,
    reconnectDelay: 5000,
    heartbeatIncoming: 4000,
    heartbeatOutgoing: 4000,
    connectHeaders: {
      Authorization: `Bearer ${token}`
    },

    onConnect: (frame) => {
      console.log('✅ WebSocket connected:', frame.headers['session']);
      isConnected = true;
      reconnectAttempts = 0;
      activeSubscriptions.clear();

      // ── 1. Personal messages ─────────────────────────────────────────
      const msgSub = stompClient.subscribe(
        `/queue/messages-${currentUser}`,
        (message) => {
          try {
            const parsed = JSON.parse(message.body);
            console.log('📩 Incoming message:', parsed);
            handleIncomingMessage(parsed);
          } catch (e) {
            console.error('Error parsing message:', e);
          }
        },
        { Authorization: `Bearer ${token}` }
      );
      activeSubscriptions.set(`messages-${currentUser}`, msgSub.id);

      // ── 2. Video call signals ─────────────────────────────────────────
      if (handleIncomingVideoSignal) {
        const vidSub = stompClient.subscribe(
          `/queue/video-${currentUser}`,
          (message) => {
            try {
              const signal = JSON.parse(message.body);
              console.log('🎥 Video signal:', signal.type, 'from', signal.sender);
              handleIncomingVideoSignal(signal);
            } catch (e) {
              console.error('Error parsing video signal:', e);
            }
          },
          { Authorization: `Bearer ${token}` }
        );
        activeSubscriptions.set(`video-${currentUser}`, vidSub.id);
      }

      // ── 3. Typing indicators ─────────────────────────────────────────
      if (handleTypingStatus) {
        const typSub = stompClient.subscribe(
          `/queue/typing-${currentUser}`,
          (message) => {
            try {
              const typing = JSON.parse(message.body);
              handleTypingStatus(typing);
            } catch (e) {
              console.error('Error parsing typing status:', e);
            }
          },
          { Authorization: `Bearer ${token}` }
        );
        activeSubscriptions.set(`typing-${currentUser}`, typSub.id);
      }

      // ── 4. Read receipts ─────────────────────────────────────────────
      if (handleReadReceipt) {
        const readSub = stompClient.subscribe(
          `/queue/read-receipts-${currentUser}`,
          (message) => {
            try {
              const receipt = JSON.parse(message.body);
              handleReadReceipt(receipt);
            } catch (e) {
              console.error('Error parsing read receipt:', e);
            }
          },
          { Authorization: `Bearer ${token}` }
        );
        activeSubscriptions.set(`read-receipts-${currentUser}`, readSub.id);
      }

      // ── 5. Presence ────────────────────────────────────────────────────
      if (handlePresenceUpdate) {
        const presSub = stompClient.subscribe(
          `/topic/presence`,
          (message) => {
            try {
              const presence = JSON.parse(message.body);
              handlePresenceUpdate(presence);
            } catch (e) {
              console.error('Error parsing presence update:', e);
            }
          },
          { Authorization: `Bearer ${token}` }
        );
        activeSubscriptions.set('presence', presSub.id);
      }

      // ── 6. Message Deletions ───────────────────────────────────────────
      const delSub = stompClient.subscribe(
        `/queue/delete-${currentUser}`,
        (message) => {
          try {
            const payload = JSON.parse(message.body);
            console.log('🗑️ Delete event:', payload);

            // Re-render UI: since we don't have exact message finding easily via data attributes,
            // we'll trigger a reload of messages using getMessages for the current receiver.
            // A more optimal approach is to modify the DOM directly if data-id exists.
            const receiver = window.getCurrentReceiver && window.getCurrentReceiver();
            if (receiver) {
              window.dispatchEvent(new CustomEvent('reload-messages'));
            }
          } catch (e) {
            console.error('Error parsing delete event:', e);
          }
        },
        { Authorization: `Bearer ${token}` }
      );
      activeSubscriptions.set(`delete-${currentUser}`, delSub.id);

      // ── 7. Message Edits ───────────────────────────────────────────────
      const editSub = stompClient.subscribe(
        `/queue/edit-${currentUser}`,
        (message) => {
          try {
            const payload = JSON.parse(message.body);
            // Re-render UI by triggering reload (same as delete for simplicity)
            window.dispatchEvent(new CustomEvent('reload-messages'));
          } catch (e) {
            console.error('Error parsing edit event:', e);
          }
        },
        { Authorization: `Bearer ${token}` }
      );
      activeSubscriptions.set(`edit-${currentUser}`, editSub.id);

      // ── 8. Chat Clears ─────────────────────────────────────────────────
      const clearSub = stompClient.subscribe(
        `/queue/clear-${currentUser}`,
        (message) => {
          try {
            const payload = JSON.parse(message.body);
            const receiver = window.getCurrentReceiver && window.getCurrentReceiver();
            // If we are currently talking to the person who cleared the chat
            if (payload.sender === receiver || payload.receiver === receiver) {
              const chatContainer = document.getElementById("chat-container");
              if (chatContainer) chatContainer.innerHTML = '';
            }
          } catch (e) {
            console.error('Error parsing clear event:', e);
          }
        },
        { Authorization: `Bearer ${token}` }
      );
      activeSubscriptions.set(`clear-${currentUser}`, clearSub.id);

      // ── Flush pending group subscriptions ────────────────────────────
      if (pendingGroupSubscriptions.length > 0) {
        console.log(`Flushing ${pendingGroupSubscriptions.length} pending group subscriptions`);
        const pending = [...pendingGroupSubscriptions];
        pendingGroupSubscriptions = [];
        pending.forEach(({ groupId, handler }) => _doSubscribeToGroup(groupId, handler));
      }
    },

    onDisconnect: () => {
      console.log('WebSocket disconnected');
      isConnected = false;
      activeSubscriptions.clear();
      pendingGroupSubscriptions = []; // clear stale queued entries on disconnect
    },

    onStompError: (frame) => {
      console.error('STOMP error:', frame.headers.message);
      isConnected = false;
    },

    onWebSocketError: (error) => {
      console.error('WebSocket error:', error);
      isConnected = false;
    }
  });

  stompClient.activate();
}

// ── Internal: actually subscribe to a group topic ──────────────────────
function _doSubscribeToGroup(groupId, handleGroupMessage) {
  const key = `group-${groupId}`;

  // If there's a previous subscription ID for this group, unsubscribe it first
  // so the new (potentially fresher-closure) handler replaces the old one
  if (activeSubscriptions.has(key)) {
    try {
      const oldSubId = activeSubscriptions.get(key);
      if (stompClient && isConnected) {
        stompClient.unsubscribe(oldSubId);
      }
    } catch (e) { /* ignore */ }
    activeSubscriptions.delete(key);
  }

  const token = localStorage.getItem('token');
  const sub = stompClient.subscribe(
    `/topic/group-${groupId}`,
    (message) => {
      try {
        const parsed = JSON.parse(message.body);
        handleGroupMessage(parsed);
      } catch (e) {
        console.error('Error parsing group message:', e);
      }
    },
    { Authorization: `Bearer ${token}` }
  );
  activeSubscriptions.set(key, sub.id);
  console.log(`✅ Subscribed to group ${groupId}`);
  return true;
}

// ── Subscribe to a group topic (queues if not yet connected) ───────────
export function subscribeToGroup(groupId, handleGroupMessage) {
  if (!stompClient || !isConnected) {
    // Queue for when connection is established
    const alreadyQueued = pendingGroupSubscriptions.some(p => p.groupId === groupId);
    if (!alreadyQueued) {
      console.log(`⏳ Queuing group subscription for group ${groupId}`);
      pendingGroupSubscriptions.push({ groupId, handler: handleGroupMessage });
    }
    return false;
  }
  return _doSubscribeToGroup(groupId, handleGroupMessage);
}

// ── Send a 1-on-1 message (with optional file) ─────────────────────────
export function sendMessages(sender, receiver, messageContent, token, fileUrl, fileName, fileType) {
  if (!stompClient || !isConnected) {
    console.warn('Cannot send — not connected');
    return false;
  }

  const payload = {
    sender,
    receiver,
    message: typeof messageContent === 'string' ? messageContent.trim() : '',
    time: new Date().toISOString(),
    fileUrl: fileUrl || null,
    fileName: fileName || null,
    fileType: fileType || null
  };

  stompClient.publish({
    destination: '/app/sendMessage',
    body: JSON.stringify(payload),
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  });

  console.log('📤 Message sent to', receiver);
  return true;
}

// ── Send a group message ────────────────────────────────────────────────
export function sendGroupMessage(groupId, sender, messageContent, token) {
  if (!stompClient || !isConnected) {
    console.warn('Cannot send group message — not connected');
    return false;
  }

  stompClient.publish({
    destination: '/app/sendGroupMessage',
    body: JSON.stringify({
      groupId,
      sender,
      message: messageContent.trim(),
      time: new Date().toISOString()
    }),
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  });

  console.log('📤 Group message sent to group', groupId);
  return true;
}

// ── Send video call signal ──────────────────────────────────────────────
export function sendVideoCallSignal(sender, receiver, type, sdp, candidate, token) {
  if (!stompClient || !isConnected) {
    console.warn('Cannot send video signal — not connected');
    return false;
  }

  const signal = { sender, receiver, type, sdp: sdp || null, candidate: candidate || null };
  console.log('📹 Sending video signal:', type, '→', receiver);

  stompClient.publish({
    destination: '/app/videoCall',
    body: JSON.stringify(signal),
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  });
  return true;
}

// ── Send typing status ──────────────────────────────────────────────────
export function sendTypingStatus(sender, receiver, isTyping, token) {
  if (!stompClient || !isConnected) return false;

  stompClient.publish({
    destination: '/app/typing',
    body: JSON.stringify({ sender, receiver, isTyping }),
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  });
  return true;
}

// ── Send read receipt ───────────────────────────────────────────────────
export function sendReadReceipt(sender, receiver, token) {
  if (!stompClient || !isConnected) return false;

  stompClient.publish({
    destination: '/app/markAsRead',
    body: JSON.stringify({ sender, receiver }),
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }
  });
  return true;
}

// ── Disconnect ──────────────────────────────────────────────────────────
export function disconnectWebSocket() {
  if (stompClient) {
    activeSubscriptions.clear();
    isConnected = false;
    stompClient.deactivate();
    stompClient = null;
    console.log('WebSocket disconnected');
  }
}

export function isWebSocketConnected() {
  return isConnected;
}
