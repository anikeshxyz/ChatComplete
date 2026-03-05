package com.chat.application.repository;

import com.chat.application.model.ChatMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChatRepository extends JpaRepository<ChatMessage, Long> {
    @Query("SELECT m FROM ChatMessage m WHERE (m.sender = :sender AND m.receiver = :recipient) OR (m.sender = :recipient AND m.receiver = :sender) ORDER BY m.createdAt ASC")
    List<ChatMessage> findChatMessagesBetweenUsers(@Param("sender") String sender,
            @Param("recipient") String recipient);

    @Modifying
    @Query("UPDATE ChatMessage m SET m.status = 'READ' WHERE m.sender = :sender AND m.receiver = :receiver AND m.status <> 'READ'")
    int markMessagesAsRead(@Param("sender") String sender, @Param("receiver") String receiver);

    @Modifying
    @Query("DELETE FROM ChatMessage m WHERE (m.sender = :user1 AND m.receiver = :user2) OR (m.sender = :user2 AND m.receiver = :user1)")
    void deleteBySenderAndReceiver(@Param("user1") String user1, @Param("user2") String user2);
}
