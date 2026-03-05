package com.chat.application.controller;

import com.chat.application.response.ChatResponse;
import com.chat.application.service.ChatService;
import com.chat.application.service.impl.FileStorageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Tag(name = "Chat", description = "Message history and file uploads for 1-on-1 chat")
@RequestMapping("${app.title}")
@CrossOrigin(origins = "*")
@RestController
public class ChatController {

    private final ChatService chatService;
    private final FileStorageService fileStorageService;
    private final org.springframework.messaging.simp.SimpMessagingTemplate simpMessagingTemplate;

    public ChatController(ChatService chatService, FileStorageService fileStorageService,
            org.springframework.messaging.simp.SimpMessagingTemplate simpMessagingTemplate) {
        this.chatService = chatService;
        this.fileStorageService = fileStorageService;
        this.simpMessagingTemplate = simpMessagingTemplate;
    }

    @Operation(summary = "Get conversation history", description = "Returns all messages exchanged between two users, ordered by creation time.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "List of chat messages"),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    })
    @GetMapping("/conversations")
    public ResponseEntity<?> fetchChatsBetweenTwoUsers(
            @Parameter(description = "Username of the sender", required = true) @RequestParam String sender,
            @Parameter(description = "Username of the receiver", required = true) @RequestParam String receiver) {
        List<ChatResponse> messageResponses = chatService.getPreviousMessagesBetweenSenderAndReceiver(sender, receiver);
        return ResponseEntity.ok(messageResponses);
    }

    @Operation(summary = "Upload a chat file", description = "Uploads an image or file attachment for use in a chat message. Returns the stored file URL, original filename, and MIME type.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "File uploaded — returns {fileUrl, fileName, fileType}"),
            @ApiResponse(responseCode = "400", description = "No file provided", content = @Content),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    })
    @PostMapping(path = "/upload-chat-file", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> uploadChatFile(
            @Parameter(description = "File to upload", required = true) @RequestPart("file") MultipartFile file) {
        String fileUrl = fileStorageService.store(file);
        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String contentType = file.getContentType() != null ? file.getContentType() : "application/octet-stream";

        Map<String, String> response = new HashMap<>();
        response.put("fileUrl", fileUrl);
        response.put("fileName", originalName);
        response.put("fileType", contentType);

        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Delete a message", description = "Deletes a specific message sent by the authenticated user.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Message deleted successfully"),
            @ApiResponse(responseCode = "403", description = "Forbidden to delete this message", content = @Content),
            @ApiResponse(responseCode = "404", description = "Message not found", content = @Content)
    })
    @DeleteMapping("/messages/{id}")
    public ResponseEntity<?> deleteMessage(
            @Parameter(description = "ID of the message to delete", required = true) @PathVariable Long id,
            java.security.Principal principal) {

        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            ChatResponse deletedMessage = chatService.deleteMessage(id, principal.getName());

            // Broadcast deletion event to the receiver
            com.chat.application.dto.DeleteMessageRequest deleteReq = new com.chat.application.dto.DeleteMessageRequest(
                    id, deletedMessage.getReceiver());
            simpMessagingTemplate.convertAndSend("/queue/delete-" + deletedMessage.getReceiver(), deleteReq);
            // Also explicitly to the sender to be safe, though their client probably
            // deleted it directly
            simpMessagingTemplate.convertAndSend("/queue/delete-" + deletedMessage.getSender(), deleteReq);

            return ResponseEntity.ok("Message deleted");
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    @Operation(summary = "Edit a message", description = "Edits a specific message sent by the authenticated user.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Message edited successfully"),
            @ApiResponse(responseCode = "403", description = "Forbidden to edit this message", content = @Content),
            @ApiResponse(responseCode = "404", description = "Message not found", content = @Content)
    })
    @PutMapping("/messages/{id}")
    public ResponseEntity<?> editMessage(
            @Parameter(description = "ID of the message to edit", required = true) @PathVariable Long id,
            @RequestBody com.chat.application.dto.EditMessageRequest editRequest,
            java.security.Principal principal) {

        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            ChatResponse editedMessage = chatService.editMessage(id, editRequest.getNewContent(), principal.getName());

            // Broadcast edit event
            simpMessagingTemplate.convertAndSend("/queue/edit-" + editedMessage.getReceiver(), editedMessage);
            simpMessagingTemplate.convertAndSend("/queue/edit-" + editedMessage.getSender(), editedMessage);

            return ResponseEntity.ok(editedMessage);
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(e.getMessage());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(404).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Internal server error");
        }
    }

    @Operation(summary = "Clear conversation", description = "Deletes all messages between the authenticated user and a specific receiver.")
    @DeleteMapping("/conversations")
    public ResponseEntity<?> clearConversation(
            @Parameter(description = "Username of the receiver", required = true) @RequestParam String receiver,
            java.security.Principal principal) {

        if (principal == null) {
            return ResponseEntity.status(401).body("Unauthorized");
        }

        try {
            chatService.clearConversation(principal.getName(), receiver);

            // Tell the receiver to clear their screen too
            simpMessagingTemplate.convertAndSend("/queue/clear-" + receiver,
                    java.util.Map.of("sender", principal.getName(), "receiver", receiver));
            simpMessagingTemplate.convertAndSend("/queue/clear-" + principal.getName(),
                    java.util.Map.of("sender", principal.getName(), "receiver", receiver));

            return ResponseEntity.ok("Conversation cleared");
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Internal server error");
        }
    }
}
