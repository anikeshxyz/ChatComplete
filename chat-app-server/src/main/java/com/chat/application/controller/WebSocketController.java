package com.chat.application.controller;

import com.chat.application.dto.MessageRequest;
import com.chat.application.dto.ReadReceiptRequest;
import com.chat.application.dto.VideoCallRequest;
import com.chat.application.service.impl.WebSocketService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Tag(name = "WebSocket (STOMP)", description = """
        STOMP message endpoints — connect via SockJS at ws://localhost:3030/chat.
        All destinations require a Bearer JWT in the CONNECT headers.

        | Destination | Purpose |
        |---|---|
        | /app/sendMessage | Send 1-on-1 message → receiver gets it at /queue/messages-{receiver} |
        | /app/sendGroupMessage | Send group message → all members get it at /topic/group-{groupId} |
        | /app/videoCall | WebRTC signalling → receiver at /queue/video-{receiver} |
        | /app/typing | Typing indicator → receiver at /queue/typing-{receiver} |
        | /app/markAsRead | Mark messages read → sender notified at /queue/read-receipts-{sender} |
        | /topic/presence | Broadcast channel: ONLINE/OFFLINE status updates |
        """)
@Controller
public class WebSocketController {

    private final WebSocketService webSocketService;

    public WebSocketController(WebSocketService webSocketService) {
        this.webSocketService = webSocketService;
    }

    @Operation(summary = "Send 1-on-1 message", description = "Publish to /app/sendMessage. Payload: {sender, receiver, message, time, fileUrl?, fileName?, fileType?}. Delivered to /queue/messages-{receiver}.")
    @MessageMapping("/sendMessage")
    public void sendMessage(@Payload MessageRequest message, Principal principal) {
        webSocketService.sendMessage(message, principal);
    }

    @Operation(summary = "Send WebRTC video call signal", description = "Publish to /app/videoCall. Payload: {sender, receiver, type, sdp?, candidate?}. Types: offer | answer | candidate | endCall. Delivered to /queue/video-{receiver}.")
    @MessageMapping("/videoCall")
    public void sendVideoCallSignal(@Payload VideoCallRequest request, Principal principal) {
        webSocketService.sendVideoCallSignal(request, principal);
    }

    @Operation(summary = "Send group message", description = "Publish to /app/sendGroupMessage. Payload: {groupId, sender, message, time}. Broadcast to /topic/group-{groupId}.")
    @MessageMapping("/sendGroupMessage")
    public void sendGroupMessage(@Payload com.chat.application.dto.GroupMessageRequest message, Principal principal) {
        webSocketService.sendGroupMessage(message, principal);
    }

    @Operation(summary = "Mark messages as read", description = "Publish to /app/markAsRead. Payload: {sender, receiver}. Notifies sender via /queue/read-receipts-{sender}.")
    @MessageMapping("/markAsRead")
    public void markAsRead(@Payload ReadReceiptRequest request, Principal principal) {
        webSocketService.markAsRead(request, principal);
    }

    @Operation(summary = "Send typing status", description = "Publish to /app/typing. Payload: {sender, receiver, isTyping}. Delivered to /queue/typing-{receiver}.")
    @MessageMapping("/typing")
    public void sendTypingStatus(@Payload com.chat.application.dto.TypingRequest request, Principal principal) {
        webSocketService.sendTypingStatus(request, principal);
    }
}