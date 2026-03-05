package com.chat.application.model;

import com.fasterxml.jackson.annotation.JsonBackReference;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "messages")
public class ChatMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)

    private Long id;
    private String sender;
    private String receiver;
    @Column(columnDefinition = "TEXT")
    private String message;

    @Column(name = "file_url")
    private String fileUrl;

    @Column(name = "file_name")
    private String fileName;

    @Column(name = "file_type")
    private String fileType;

    @Column(name = "status")
    private String status = "SENT";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id")
    @JsonBackReference
    private User user;

    @Column(name = "time")
    private String time;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "is_edited", nullable = false, columnDefinition = "boolean default false")
    private boolean isEdited = false;
}
