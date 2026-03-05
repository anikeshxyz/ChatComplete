package com.chat.application.otp;

import org.springframework.data.annotation.Id;
import org.springframework.data.redis.core.RedisHash;
import org.springframework.data.redis.core.TimeToLive;

import java.time.Instant;

@RedisHash("otpData")
public class OtpData {

    @Id
    private String phoneNumber;

    private String otp;
    private Instant expiresAt;

    @TimeToLive
    private Long timeToLive; // in seconds

    private int resendCount;
    private Instant lastSentAt;

    // Default constructor for Redis
    public OtpData() {
    }

    public OtpData(String phoneNumber, String otp, Instant expiresAt, long timeToLiveSeconds) {
        this.phoneNumber = phoneNumber;
        this.otp = otp;
        this.expiresAt = expiresAt;
        this.timeToLive = timeToLiveSeconds;
        this.resendCount = 0;
        this.lastSentAt = Instant.now();
    }

    public String getPhoneNumber() {
        return phoneNumber;
    }

    public String getOtp() {
        return otp;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public int getResendCount() {
        return resendCount;
    }

    public Instant getLastSentAt() {
        return lastSentAt;
    }

    public void incrementResend() {
        this.resendCount++;
        this.lastSentAt = Instant.now();
    }

    public boolean isExpired() {
        // We can still use this as a soft check, but Redis TTL will hard-expire the key
        if (expiresAt == null)
            return false;
        return Instant.now().isAfter(expiresAt);
    }
}
