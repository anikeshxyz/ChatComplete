package com.chat.application.response;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class GroupMessageResponse {
    private Long id;
    private Long groupId;
    private UserResponse sender;
    private String message;
    private String time;
    private LocalDateTime createdAt;
}
