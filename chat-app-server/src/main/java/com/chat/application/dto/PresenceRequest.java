package com.chat.application.dto;

import lombok.*;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PresenceRequest {
    private String username;
    private String status; // "ONLINE" or "OFFLINE"
}
