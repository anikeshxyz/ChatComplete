package com.chat.application.utility;

import com.chat.application.dto.UserRegistrationRequests;
import com.chat.application.model.ChatMessage;
import com.chat.application.model.User;
import com.chat.application.response.ChatResponse;
import com.chat.application.response.GroupMessageResponse;
import com.chat.application.response.GroupResponse;
import com.chat.application.response.UserResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

@Component
public class DtoMapper {

    public List<UserResponse> buildUserResponse(List<User> users) {

        if (CollectionUtils.isEmpty(users)) {
            return Collections.emptyList();
        }

        List<UserResponse> userResponses = new ArrayList<>();

        for (User user : users) {
            userResponses.add(buildUserResponse(user));
        }

        return userResponses;
    }

    public UserResponse buildUserResponse(User user) {

        UserResponse userResponse = new UserResponse();
        userResponse.setId(user.getId());
        userResponse.setUsername(user.getUsername());
        userResponse.setFirstname(user.getFirstname());
        userResponse.setLastname(user.getLastname());
        userResponse.setEmail(user.getEmail());
        userResponse.setPhoneNumber(user.getPhoneNumber());
        userResponse.setProfilePicture(user.getProfilePicture());
        userResponse.setAbout(user.getAbout());

        return userResponse;
    }

    public List<ChatResponse> buildChatResponses(List<ChatMessage> messages) {

        if (CollectionUtils.isEmpty(messages)) {
            return Collections.emptyList();
        }

        List<ChatResponse> chatResponses = new ArrayList<>();
        for (ChatMessage message : messages) {
            chatResponses.add(buildChatResponse(message));
        }
        return chatResponses;
    }

    public ChatResponse buildChatResponse(ChatMessage message) {
        ChatResponse response = new ChatResponse();
        response.setId(message.getId());
        response.setSender(message.getSender());
        response.setReceiver(message.getReceiver());
        response.setMessage(message.getMessage());
        response.setTime(message.getTime());
        response.setFileUrl(message.getFileUrl());
        response.setFileName(message.getFileName());
        response.setFileType(message.getFileType());
        response.setStatus(message.getStatus());
        response.setEdited(message.isEdited());

        return response;
    }

    public UserRegistrationRequests createUserRequest(String firstName, String lastName, String username, String email,
            String phoneNumber, String password, String confirmPassword) {
        UserRegistrationRequests request = new UserRegistrationRequests();
        request.setFirstname(firstName);
        request.setLastname(lastName);
        request.setUsername(username);
        request.setEmail(email);
        request.setPhoneNumber(phoneNumber);
        request.setPassword(password);
        request.setConfirmPassword(confirmPassword);
        return request;
    }

    public GroupResponse buildGroupResponse(com.chat.application.model.Group group) {
        if (group == null)
            return null;
        GroupResponse response = new GroupResponse();
        response.setId(group.getId());
        response.setName(group.getName());
        response.setAdmin(buildUserResponse(group.getAdmin()));
        response.setMembers(buildUserResponse(new ArrayList<>(group.getMembers())));
        response.setCreatedAt(group.getCreatedAt());
        return response;
    }

    public GroupMessageResponse buildGroupMessageResponse(com.chat.application.model.GroupMessage message) {
        if (message == null)
            return null;
        GroupMessageResponse response = new GroupMessageResponse();
        response.setId(message.getId());
        response.setGroupId(message.getGroup().getId());
        response.setSender(buildUserResponse(message.getSender()));
        response.setMessage(message.getMessage());
        response.setTime(message.getTime());
        response.setCreatedAt(message.getCreatedAt());
        return response;
    }
}
