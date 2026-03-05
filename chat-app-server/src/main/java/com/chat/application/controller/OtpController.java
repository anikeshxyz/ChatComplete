package com.chat.application.controller;

import com.chat.application.otp.OtpService;
import com.chat.application.response.LoginResponse;
import com.chat.application.service.UsersService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@Tag(name = "OTP / Phone Auth", description = "Send and verify OTPs for phone-based authentication")
@RequestMapping("${app.title}")
@CrossOrigin(origins = "*")
@RestController
public class OtpController {

    private final OtpService otpService;
    private final UsersService usersService;

    public OtpController(OtpService otpService, UsersService usersService) {
        this.otpService = otpService;
        this.usersService = usersService;
    }

    @Operation(summary = "Send OTP", description = "Sends a one-time password (OTP) to the specified phone number. No auth required.", security = {})
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "OTP sent successfully"),
            @ApiResponse(responseCode = "400", description = "Phone number missing or OTP delivery failed", content = @Content)
    })
    @PostMapping("/send-otp")
    public ResponseEntity<?> sendOtp(@RequestBody Map<String, String> request) {
        String phoneNumber = request.get("phoneNumber");
        if (phoneNumber == null || phoneNumber.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("message", "Phone number is required"));
        }
        try {
            otpService.sendOtp(phoneNumber);
            return ResponseEntity.ok(Map.of("message", "OTP sent successfully"));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }

    @Operation(summary = "Verify OTP", description = "Verifies the OTP for a given phone number. Returns verified=true/false. No auth required.", security = {})
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "OTP verified"),
            @ApiResponse(responseCode = "400", description = "Invalid or expired OTP", content = @Content)
    })
    @PostMapping("/verify-otp")
    public ResponseEntity<?> verifyOtp(@RequestBody Map<String, String> request) {
        String phoneNumber = request.get("phoneNumber");
        String otp = request.get("otp");
        if (phoneNumber == null || otp == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Phone number and OTP are required"));
        }
        boolean verified = otpService.verify(phoneNumber, otp);
        if (verified) {
            return ResponseEntity.ok(Map.of("message", "OTP verified successfully", "verified", true));
        } else {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid or expired OTP", "verified", false));
        }
    }

    @Operation(summary = "Login with OTP", description = "Verifies the OTP and, if valid, logs the user in and returns a JWT token. No auth required.", security = {})
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Login successful — JWT token returned"),
            @ApiResponse(responseCode = "400", description = "Invalid OTP or user not found", content = @Content)
    })
    @PostMapping("/login-otp")
    public ResponseEntity<?> loginWithOtp(@RequestBody Map<String, String> request) {
        String phoneNumber = request.get("phoneNumber");
        String otp = request.get("otp");
        if (phoneNumber == null || otp == null) {
            return ResponseEntity.badRequest().body(Map.of("message", "Phone number and OTP are required"));
        }
        boolean verified = otpService.verify(phoneNumber, otp);
        if (!verified) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid or expired OTP"));
        }
        try {
            LoginResponse loginResponse = usersService.loginByPhone(phoneNumber);
            return ResponseEntity.ok(loginResponse);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("message", e.getMessage()));
        }
    }
}
