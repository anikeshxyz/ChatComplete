package com.chat.application.service;

import com.chat.application.dto.MessageRequest;
import com.chat.application.response.ChatResponse;

import java.util.List;

public interface ChatService {
    ChatResponse saveChat(MessageRequest request);

    List<ChatResponse> getPreviousMessagesBetweenSenderAndReceiver(String sender, String receiver);

    int markMessagesAsRead(String sender, String receiver);

    ChatResponse deleteMessage(Long messageId, String username);

    ChatResponse editMessage(Long messageId, String newContent, String username);

    void clearConversation(String username, String receiver);
}
