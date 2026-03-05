package com.chat.application.service;

import com.chat.application.dto.GroupMessageRequest;
import com.chat.application.dto.GroupRequest;
import com.chat.application.response.BaseResponse;
import com.chat.application.response.GroupMessageResponse;
import com.chat.application.response.GroupResponse;

import java.util.List;

public interface GroupService {
    BaseResponse createGroup(String adminUsername, GroupRequest request);

    BaseResponse addMembers(Long groupId, String adminUsername, List<String> memberUsernames);

    List<GroupResponse> getUserGroups(String username);

    GroupMessageResponse saveGroupMessage(GroupMessageRequest request);

    List<GroupMessageResponse> getGroupMessages(Long groupId);
}
