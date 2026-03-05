package com.chat.application.response;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ChatResponse {
    private Long id;
    private String sender;
    private String receiver;
    private String message;
    private String time;
    private String fileUrl;
    private String fileName;
    private String fileType;
    private String status;
    private boolean isEdited;
}
