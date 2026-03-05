package com.chat.application.controller;

import com.chat.application.dto.LoginRequest;
import com.chat.application.dto.UserRegistrationRequests;
import com.chat.application.exception.AuthenticationException;
import com.chat.application.response.BaseResponse;
import com.chat.application.response.LoginResponse;
import com.chat.application.response.UserResponse;
import com.chat.application.service.UsersService;
import com.chat.application.service.impl.PresenceService;
import com.chat.application.utility.DtoMapper;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.security.Principal;
import java.util.List;
import java.util.Set;

@Tag(name = "Users", description = "User registration, login, profile management and presence")
@RequestMapping("${app.title}")
@CrossOrigin(origins = "*")
@RestController
public class UserController {

    private final UsersService userService;
    private final DtoMapper mapper;
    private final PresenceService presenceService;

    @Autowired
    public UserController(UsersService userService, DtoMapper mapper, PresenceService presenceService) {
        this.userService = userService;
        this.mapper = mapper;
        this.presenceService = presenceService;
    }

    @Operation(summary = "Register a new user", description = "Creates a new user account with profile picture. All fields are required multipart form data.", security = {}) // no
                                                                                                                                                                              // JWT
                                                                                                                                                                              // required
                                                                                                                                                                              // for
                                                                                                                                                                              // registration
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "User registered successfully"),
            @ApiResponse(responseCode = "400", description = "Validation error or username already exists", content = @Content)
    })
    @PostMapping(path = "/create-user", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> registerUser(
            @RequestPart("first_name") String firstName,
            @RequestPart("last_name") String lastName,
            @RequestPart("username") String username,
            @RequestPart("email") String email,
            @RequestPart("phone_number") String phoneNumber,
            @RequestPart("password") String password,
            @RequestPart("confirm_password") String confirmPassword,
            @RequestPart("profilePicture") MultipartFile profilePicture) throws IOException {

        UserRegistrationRequests userRequest = mapper.createUserRequest(firstName, lastName, username, email,
                phoneNumber, password, confirmPassword);
        BaseResponse response = userService.registerUser(userRequest, profilePicture);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Login", description = "Authenticates a user and returns a JWT token.", security = {})
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful — token returned"),
            @ApiResponse(responseCode = "401", description = "Invalid credentials", content = @Content)
    })
    @PostMapping("/login-user")
    public ResponseEntity<?> loginUser(@RequestBody LoginRequest loginRequest) {
        LoginResponse loginResponse = userService.login(loginRequest);
        return ResponseEntity.ok(loginResponse);
    }

    @Operation(summary = "Get all users", description = "Returns a list of all registered users.")
    @ApiResponse(responseCode = "200", description = "List of users")
    @GetMapping("get-users")
    public ResponseEntity<?> getAllUsers() {
        List<UserResponse> users = userService.getAllUsers();
        return ResponseEntity.ok(users);
    }

    @Operation(summary = "Logout", description = "Invalidates the current session token.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Logged out successfully"),
            @ApiResponse(responseCode = "400", description = "Missing or malformed Authorization header", content = @Content)
    })
    @DeleteMapping("/logout")
    public ResponseEntity<?> logoutUser(
            @Parameter(description = "Bearer JWT token", required = true) @RequestHeader("Authorization") String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith("Bearer ")) {
            throw new AuthenticationException("Invalid Authorization header", HttpStatus.BAD_REQUEST);
        }
        String token = authorizationHeader.substring(7);
        BaseResponse response = userService.logout(token);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update profile picture", description = "Replaces the current user's profile picture.")
    @ApiResponse(responseCode = "200", description = "Profile picture updated")
    @PostMapping(path = "/update-profile-picture", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> updateProfilePicture(Principal principal,
            @RequestPart("profilePicture") MultipartFile profilePicture) {
        BaseResponse response = userService.updateProfilePicture(principal.getName(), profilePicture);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Update about text", description = "Updates the current user's about/bio field.")
    @ApiResponse(responseCode = "200", description = "About text updated")
    @PutMapping(path = "/update-about")
    public ResponseEntity<?> updateAbout(Principal principal,
            @Parameter(description = "New about text") @RequestParam("about") String about) {
        BaseResponse response = userService.updateAbout(principal.getName(), about);
        return ResponseEntity.ok(response);
    }

    @Operation(summary = "Get online users", description = "Returns the set of usernames currently connected via WebSocket.")
    @ApiResponse(responseCode = "200", description = "Set of online usernames", content = @Content(schema = @Schema(type = "array", example = "[\"alice\", \"bob\"]")))
    @GetMapping("/online-users")
    public ResponseEntity<Set<String>> getOnlineUsers() {
        return ResponseEntity.ok(presenceService.getOnlineUsers());
    }
}
