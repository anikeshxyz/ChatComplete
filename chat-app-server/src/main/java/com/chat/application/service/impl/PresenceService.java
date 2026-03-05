package com.chat.application.service.impl;

import com.chat.application.dto.PresenceRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

/**
 * Tracks online users in-memory using a ConcurrentHashMap.
 * Broadcasts presence updates to all subscribers of /topic/presence.
 */
@Service
public class PresenceService {

    private static final Logger logger = LoggerFactory.getLogger(PresenceService.class);

    // username → "ONLINE" | "OFFLINE"
    private final Map<String, String> presenceMap = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;

    public PresenceService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Called when a user connects or disconnects from WebSocket.
     * Broadcasts to /topic/presence so all clients can update their UI.
     */
    public void updatePresence(String username, String status) {
        if (username == null || username.isBlank())
            return;

        if ("OFFLINE".equals(status)) {
            presenceMap.remove(username);
        } else {
            presenceMap.put(username, "ONLINE");
        }

        PresenceRequest broadcast = new PresenceRequest(username, status);
        messagingTemplate.convertAndSend("/topic/presence", broadcast);
        logger.info("Presence update: {} is {}", username, status);
    }

    /**
     * Returns the set of currently online usernames.
     */
    public Set<String> getOnlineUsers() {
        return presenceMap.keySet().stream().collect(Collectors.toSet());
    }

    public String getStatus(String username) {
        return presenceMap.getOrDefault(username, "OFFLINE");
    }
}
