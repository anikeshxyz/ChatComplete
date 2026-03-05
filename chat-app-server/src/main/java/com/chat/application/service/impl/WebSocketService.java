package com.chat.application.service.impl;

import com.chat.application.dto.MessageRequest;
import com.chat.application.dto.ReadReceiptRequest;
import com.chat.application.dto.VideoCallRequest;
import com.chat.application.response.ChatResponse;
import com.chat.application.service.ChatService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

@Service
public class WebSocketService {
    private static final Logger logger = LoggerFactory.getLogger(WebSocketService.class);
    private final SimpMessagingTemplate simpMessagingTemplate;
    private final ChatService chatService;
    private final com.chat.application.service.GroupService groupService;
    private final GeminiApiClient geminiApiClient;

    public WebSocketService(SimpMessagingTemplate simpMessagingTemplate, ChatService chatService,
            com.chat.application.service.GroupService groupService, GeminiApiClient geminiApiClient) {
        this.simpMessagingTemplate = simpMessagingTemplate;
        this.chatService = chatService;
        this.groupService = groupService;
        this.geminiApiClient = geminiApiClient;
    }

    public void sendMessage(MessageRequest message, Principal principal) {

        if (principal == null || !principal.getName().equals(message.getSender())) {
            throw new SecurityException("Unauthorized message sender");
        }

        ChatResponse chatResponse = chatService.saveChat(message);
        String receiverDestination = "/queue/messages-" + message.getReceiver();
        simpMessagingTemplate.convertAndSend(receiverDestination, chatResponse);

        String senderDestination = "/queue/messages-" + message.getSender();
        simpMessagingTemplate.convertAndSend(senderDestination, chatResponse);
        logger.info("Message successfully processed and forwarded to {}", message.getReceiver());

        // Handle AI Assistant
        if ("AI Assistant".equals(message.getReceiver())) {
            handleAiAssistant(message);
        }
    }

    private void handleAiAssistant(MessageRequest userMessage) {
        String prompt = userMessage.getMessage();
        logger.info("Handling message for AI Assistant: {}", prompt);

        // Run AI generation asynchronously to avoid blocking the WebSocket thread
        new Thread(() -> {
            try {
                // Send a typing indicator to the user
                sendTypingToUser(userMessage.getSender(), true);

                String aiResponseText = geminiApiClient.generateContent(prompt);

                // If it's a JSON error from GeminiApiClient, we might want to clean it up
                if (aiResponseText != null && aiResponseText.contains("\"error\":")) {
                    aiResponseText = "I'm sorry, I'm having trouble processing your request right now. Please try again later.";
                }

                MessageRequest aiMessageRequest = new MessageRequest();
                aiMessageRequest.setSender("AI Assistant");
                aiMessageRequest.setReceiver(userMessage.getSender());
                aiMessageRequest.setMessage(aiResponseText);
                aiMessageRequest.setTime(java.time.OffsetDateTime.now().toString());

                ChatResponse aiChatResponse = chatService.saveChat(aiMessageRequest);

                String userDestination = "/queue/messages-" + userMessage.getSender();
                simpMessagingTemplate.convertAndSend(userDestination, aiChatResponse);

                // Stop typing indicator
                sendTypingToUser(userMessage.getSender(), false);

                logger.info("AI Assistant responded to {}", userMessage.getSender());
            } catch (Exception e) {
                logger.error("Error in AI Assistant response", e);
                sendTypingToUser(userMessage.getSender(), false);
                try {
                    MessageRequest fallbackReq = new MessageRequest();
                    fallbackReq.setSender("AI Assistant");
                    fallbackReq.setReceiver(userMessage.getSender());
                    fallbackReq.setMessage("I encountered an internal error. Please try again.");
                    fallbackReq.setTime(java.time.OffsetDateTime.now().toString());
                    ChatResponse fallbackRes = chatService.saveChat(fallbackReq);
                    String userDestination = "/queue/messages-" + userMessage.getSender();
                    simpMessagingTemplate.convertAndSend(userDestination, fallbackRes);
                } catch (Exception ex) {
                    logger.error("Failed to send fallback message", ex);
                }
            }
        }).start();
    }

    private void sendTypingToUser(String username, boolean isTyping) {
        com.chat.application.dto.TypingRequest typingRequest = new com.chat.application.dto.TypingRequest();
        typingRequest.setSender("AI Assistant");
        typingRequest.setReceiver(username);
        typingRequest.setIsTyping(isTyping);

        String userDestination = "/queue/typing-" + username;
        simpMessagingTemplate.convertAndSend(userDestination, typingRequest);
    }

    public void sendVideoCallSignal(VideoCallRequest request, Principal principal) {
        if (principal == null || !principal.getName().equals(request.getSender())) {
            throw new SecurityException("Unauthorized video call sender");
        }

        String receiverDestination = "/queue/video-" + request.getReceiver();
        simpMessagingTemplate.convertAndSend(receiverDestination, request);
        logger.info("Video call signal of type {} processed and forwarded from {} to {}", request.getType(),
                request.getSender(), request.getReceiver());
    }

    public void sendGroupMessage(com.chat.application.dto.GroupMessageRequest message, Principal principal) {
        if (principal == null || !principal.getName().equals(message.getSender())) {
            throw new SecurityException("Unauthorized group message sender");
        }

        com.chat.application.response.GroupMessageResponse response = groupService.saveGroupMessage(message);
        String receiverDestination = "/topic/group-" + message.getGroupId();
        simpMessagingTemplate.convertAndSend(receiverDestination, response);
        logger.info("Group message successfully processed and broadcasted to topic {}", receiverDestination);
    }

    public void markAsRead(ReadReceiptRequest request, Principal principal) {
        if (principal == null || !principal.getName().equals(request.getReceiver())) {
            throw new SecurityException("Unauthorized read receipt sender");
        }

        int updatedCount = chatService.markMessagesAsRead(request.getSender(), request.getReceiver());
        logger.info("Marked {} messages as read from {} to {}", updatedCount, request.getSender(),
                request.getReceiver());

        if (updatedCount > 0) {
            // Notify the original sender that their messages have been read
            Map<String, String> receipt = new HashMap<>();
            receipt.put("sender", request.getSender());
            receipt.put("reader", request.getReceiver());
            receipt.put("status", "READ");

            String senderDestination = "/queue/read-receipts-" + request.getSender();
            simpMessagingTemplate.convertAndSend(senderDestination, receipt);
        }
    }

    public void sendTypingStatus(com.chat.application.dto.TypingRequest request, Principal principal) {
        if (principal == null || !principal.getName().equals(request.getSender())) {
            throw new SecurityException("Unauthorized typing status sender");
        }

        String receiverDestination = "/queue/typing-" + request.getReceiver();
        simpMessagingTemplate.convertAndSend(receiverDestination, request);
    }
}