package com.chat.application.service.impl;

import com.chat.application.dto.MessageRequest;
import com.chat.application.model.ChatMessage;
import com.chat.application.model.User;
import com.chat.application.repository.ChatRepository;
import com.chat.application.repository.UserRepository;
import com.chat.application.response.ChatResponse;
import com.chat.application.service.ChatService;
import com.chat.application.utility.DtoMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class ChatServiceImpl implements ChatService {

    private final Logger logger = LoggerFactory.getLogger(ChatServiceImpl.class);
    private final ChatRepository chatRepository;
    private final UserRepository userRepository;
    private final DtoMapper mapper;
    private final EncryptionService encryptionService;

    public ChatServiceImpl(ChatRepository chatRepository, UserRepository userRepository, DtoMapper mapper,
            EncryptionService encryptionService) {
        this.chatRepository = chatRepository;
        this.userRepository = userRepository;
        this.mapper = mapper;
        this.encryptionService = encryptionService;
    }

    @Override
    public ChatResponse saveChat(MessageRequest message) {

        User user = userRepository.findByUsername(message.getSender())
                .orElseThrow(() -> new UsernameNotFoundException(
                        "No user found with the provided username " + message.getSender()));

        logger.info("Incoming message {}", message);

        ChatMessage chat = createChat(message, user);
        return mapper.buildChatResponse(chat);
    }

    private ChatMessage createChat(MessageRequest request, User user) {

        ChatMessage message = new ChatMessage();
        message.setSender(request.getSender());
        message.setReceiver(request.getReceiver());

        // Encrypt message before saving
        String originalMessage = request.getMessage();
        if (originalMessage != null && !originalMessage.isEmpty()) {
            message.setMessage(encryptionService.encrypt(originalMessage));
        } else {
            message.setMessage(originalMessage);
        }

        message.setTime(request.getTime());
        message.setFileUrl(request.getFileUrl());
        message.setFileName(request.getFileName());
        message.setFileType(request.getFileType());
        message.setStatus("SENT");
        message.setCreatedAt(LocalDateTime.now());
        message.setUser(user);

        ChatMessage saved = chatRepository.save(message);

        // Return with decrypted message so sender sees it immediately
        saved.setMessage(originalMessage);
        return saved;
    }

    @Override
    public List<ChatResponse> getPreviousMessagesBetweenSenderAndReceiver(String sender, String receiver) {
        List<ChatMessage> chatMessages = chatRepository.findChatMessagesBetweenUsers(sender, receiver);

        // Decrypt messages before returning
        for (ChatMessage msg : chatMessages) {
            if (msg.getMessage() != null && !msg.getMessage().isEmpty()) {
                msg.setMessage(encryptionService.decrypt(msg.getMessage()));
            }
        }

        return mapper.buildChatResponses(chatMessages);
    }

    @Override
    @Transactional
    public int markMessagesAsRead(String sender, String receiver) {
        return chatRepository.markMessagesAsRead(sender, receiver);
    }

    @Override
    @Transactional
    public ChatResponse deleteMessage(Long messageId, String username) {
        ChatMessage message = chatRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        if (!message.getSender().equals(username)) {
            throw new SecurityException("You can only delete your own messages");
        }

        ChatResponse response = mapper.buildChatResponse(message);
        chatRepository.delete(message);

        return response;
    }

    @Override
    @Transactional
    public ChatResponse editMessage(Long messageId, String newContent, String username) {
        ChatMessage message = chatRepository.findById(messageId)
                .orElseThrow(() -> new IllegalArgumentException("Message not found"));

        if (!message.getSender().equals(username)) {
            throw new SecurityException("You can only edit your own messages");
        }

        if (newContent != null && !newContent.isEmpty()) {
            message.setMessage(encryptionService.encrypt(newContent));
            message.setEdited(true);
        }

        ChatMessage saved = chatRepository.save(message);

        // Return decrypted
        saved.setMessage(newContent);
        return mapper.buildChatResponse(saved);
    }

    @Override
    @Transactional
    public void clearConversation(String username, String receiver) {
        chatRepository.deleteBySenderAndReceiver(username, receiver);
    }
}
