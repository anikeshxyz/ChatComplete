package com.chat.application.controller;

import com.chat.application.dto.GroupRequest;
import com.chat.application.response.BaseResponse;
import com.chat.application.response.GroupMessageResponse;
import com.chat.application.response.GroupResponse;
import com.chat.application.service.GroupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;

@Tag(name = "Groups", description = "Create groups, manage members and retrieve group message history")
@RestController
@RequestMapping("${app.title}/groups")
@CrossOrigin(origins = "*")
public class GroupController {

    private final GroupService groupService;

    public GroupController(GroupService groupService) {
        this.groupService = groupService;
    }

    @Operation(summary = "Create a group", description = "Creates a new group. The authenticated user becomes admin and is automatically added as a member. Provide optional initial member usernames in the request body.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Group created"),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    })
    @PostMapping("/create")
    public ResponseEntity<BaseResponse> createGroup(
            Principal principal,
            @RequestBody GroupRequest request) {
        BaseResponse response = groupService.createGroup(principal.getName(), request);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }

    @Operation(summary = "Add members to a group", description = "Admin-only: accepts a list of usernames and adds them to the group.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Members added"),
            @ApiResponse(responseCode = "403", description = "Only the admin can add members", content = @Content),
            @ApiResponse(responseCode = "404", description = "Group not found", content = @Content)
    })
    @PostMapping("/{groupId}/add-members")
    public ResponseEntity<BaseResponse> addMembers(
            Principal principal,
            @Parameter(description = "Group ID", required = true) @PathVariable Long groupId,
            @RequestBody List<String> memberUsernames) {
        BaseResponse response = groupService.addMembers(groupId, principal.getName(), memberUsernames);
        return ResponseEntity.status(response.getStatusCode()).body(response);
    }

    @Operation(summary = "Get my groups", description = "Returns all groups the authenticated user is a member of.")
    @ApiResponse(responseCode = "200", description = "List of groups")
    @GetMapping("/my-groups")
    public ResponseEntity<List<GroupResponse>> getMyGroups(Principal principal) {
        List<GroupResponse> groups = groupService.getUserGroups(principal.getName());
        return ResponseEntity.ok(groups);
    }

    @Operation(summary = "Get group messages", description = "Returns the full message history for a group, ordered by creation time.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List of group messages"),
            @ApiResponse(responseCode = "404", description = "Group not found", content = @Content)
    })
    @GetMapping("/{groupId}/messages")
    public ResponseEntity<List<GroupMessageResponse>> getGroupMessages(
            @Parameter(description = "Group ID", required = true) @PathVariable Long groupId) {
        List<GroupMessageResponse> messages = groupService.getGroupMessages(groupId);
        return ResponseEntity.ok(messages);
    }
}
