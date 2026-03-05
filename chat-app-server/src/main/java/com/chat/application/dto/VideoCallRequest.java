package com.chat.application.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class VideoCallRequest {
    private String sender;
    private String receiver;
    private String type; // offer, answer, candidate, endCall
    private String sdp;
    private Object candidate; // Using Object to hold any JSON structure candidate might have
}
