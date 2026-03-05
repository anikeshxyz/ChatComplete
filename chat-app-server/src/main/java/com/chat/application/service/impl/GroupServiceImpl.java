package com.chat.application.service.impl;

import com.chat.application.dto.GroupMessageRequest;
import com.chat.application.dto.GroupRequest;
import com.chat.application.exception.ResourceNotFoundException;
import com.chat.application.model.Group;
import com.chat.application.model.GroupMessage;
import com.chat.application.model.User;
import com.chat.application.repository.GroupMessageRepository;
import com.chat.application.repository.GroupRepository;
import com.chat.application.repository.UserRepository;
import com.chat.application.response.BaseResponse;
import com.chat.application.response.GroupMessageResponse;
import com.chat.application.response.GroupResponse;
import com.chat.application.service.GroupService;
import com.chat.application.utility.DtoMapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Service;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class GroupServiceImpl implements GroupService {

    private final GroupRepository groupRepository;
    private final GroupMessageRepository groupMessageRepository;
    private final UserRepository userRepository;
    private final DtoMapper mapper;

    public GroupServiceImpl(GroupRepository groupRepository, GroupMessageRepository groupMessageRepository,
            UserRepository userRepository, DtoMapper mapper) {
        this.groupRepository = groupRepository;
        this.groupMessageRepository = groupMessageRepository;
        this.userRepository = userRepository;
        this.mapper = mapper;
    }

    @Override
    public BaseResponse createGroup(String adminUsername, GroupRequest request) {
        User admin = userRepository.findByUsername(adminUsername)
                .orElseThrow(() -> new UsernameNotFoundException("Admin user not found"));

        Group group = new Group();
        group.setName(request.getName());
        group.setAdmin(admin);
        group.setCreatedAt(LocalDateTime.now());
        group.getMembers().add(admin);

        if (request.getMemberUsernames() != null) {
            for (String username : request.getMemberUsernames()) {
                userRepository.findByUsername(username).ifPresent(user -> group.getMembers().add(user));
            }
        }

        Group savedGroup = groupRepository.save(group);
        return new BaseResponse(HttpServletResponse.SC_CREATED, "Group created successfully",
                mapper.buildGroupResponse(savedGroup));
    }

    @Override
    public BaseResponse addMembers(Long groupId, String adminUsername, List<String> memberUsernames) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        if (!group.getAdmin().getUsername().equals(adminUsername)) {
            throw new SecurityException("Only admin can add members");
        }

        for (String username : memberUsernames) {
            userRepository.findByUsername(username).ifPresent(user -> group.getMembers().add(user));
        }

        Group savedGroup = groupRepository.save(group);
        return new BaseResponse(HttpServletResponse.SC_OK, "Members added successfully",
                mapper.buildGroupResponse(savedGroup));
    }

    @Override
    public List<GroupResponse> getUserGroups(String username) {
        User user = userRepository.findByUsername(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));

        List<Group> groups = groupRepository.findByMembersContaining(user);
        return groups.stream().map(mapper::buildGroupResponse).collect(Collectors.toList());
    }

    @Override
    public GroupMessageResponse saveGroupMessage(GroupMessageRequest request) {
        Group group = groupRepository.findById(request.getGroupId())
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        User sender = userRepository.findByUsername(request.getSender())
                .orElseThrow(() -> new UsernameNotFoundException("Sender not found"));

        if (!group.getMembers().contains(sender)) {
            throw new SecurityException("Sender is not a member of this group");
        }

        GroupMessage message = new GroupMessage();
        message.setGroup(group);
        message.setSender(sender);
        message.setMessage(request.getMessage());
        message.setTime(request.getTime());
        message.setCreatedAt(LocalDateTime.now());

        GroupMessage savedMessage = groupMessageRepository.save(message);
        return mapper.buildGroupMessageResponse(savedMessage);
    }

    @Override
    public List<GroupMessageResponse> getGroupMessages(Long groupId) {
        Group group = groupRepository.findById(groupId)
                .orElseThrow(() -> new ResourceNotFoundException("Group not found"));

        List<GroupMessage> messages = groupMessageRepository.findByGroupOrderByCreatedAtAsc(group);
        return messages.stream().map(mapper::buildGroupMessageResponse).collect(Collectors.toList());
    }
}
