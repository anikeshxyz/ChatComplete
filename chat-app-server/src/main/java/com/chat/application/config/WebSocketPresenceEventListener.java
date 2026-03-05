package com.chat.application.config;

import com.chat.application.service.impl.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/**
 * Listens for STOMP session connect/disconnect events to automatically
 * broadcast online/offline status changes — no client heartbeat needed.
 */
@Component
public class WebSocketPresenceEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketPresenceEventListener.class);
    private final PresenceService presenceService;

    public WebSocketPresenceEventListener(PresenceService presenceService) {
        this.presenceService = presenceService;
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        StompHeaderAccessor sha = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = sha.getUser();
        if (principal != null) {
            String username = principal.getName();
            presenceService.updatePresence(username, "ONLINE");
            logger.info("User connected: {}", username);
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor sha = StompHeaderAccessor.wrap(event.getMessage());
        Principal principal = sha.getUser();
        if (principal != null) {
            String username = principal.getName();
            presenceService.updatePresence(username, "OFFLINE");
            logger.info("User disconnected: {}", username);
        }
    }
}
