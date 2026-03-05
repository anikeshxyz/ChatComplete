package com.chat.application.otp;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.Random;

@Service
public class OtpService {

    private static final Logger logger = LoggerFactory.getLogger(OtpService.class);
    private static final int OTP_EXPIRY_MINUTES = 1;
    private static final int MAX_RESEND = 3;
    private static final Duration RESEND_COOLDOWN = Duration.ofSeconds(30);

    private final OtpRepository otpRepository;
    private final Random random = new Random();

    public OtpService(OtpRepository otpRepository) {
        this.otpRepository = otpRepository;
    }

    public void sendOtp(String phoneNumber) {

        Optional<OtpData> existingOpt = otpRepository.findById(phoneNumber);

        if (existingOpt.isPresent()) {
            OtpData existing = existingOpt.get();
            // Expired OTP → reset
            if (existing.isExpired()) {
                otpRepository.deleteById(phoneNumber);
            } else {
                // Rate limit check
                if (existing.getResendCount() >= MAX_RESEND) {
                    throw new RuntimeException("OTP resend limit exceeded. Please try again later.");
                }

                if (Duration.between(existing.getLastSentAt(), Instant.now())
                        .compareTo(RESEND_COOLDOWN) < 0) {
                    throw new RuntimeException("Please wait before requesting OTP again.");
                }

                existing.incrementResend();
                otpRepository.save(existing);
                printOtp(existing.getOtp(), phoneNumber);
                return;
            }
        }

        // Generate new OTP
        String otp = generateOtp();
        Instant expiry = Instant.now().plus(Duration.ofMinutes(OTP_EXPIRY_MINUTES));
        long timeToLiveSeconds = Duration.ofMinutes(OTP_EXPIRY_MINUTES).getSeconds();

        OtpData newOtpData = new OtpData(phoneNumber, otp, expiry, timeToLiveSeconds);
        otpRepository.save(newOtpData);
        printOtp(otp, phoneNumber);
    }

    public boolean verify(String phoneNumber, String otp) {

        Optional<OtpData> dataOpt = otpRepository.findById(phoneNumber);

        if (dataOpt.isEmpty()) {
            return false;
        }

        OtpData data = dataOpt.get();

        if (data.isExpired()) {
            otpRepository.deleteById(phoneNumber);
            return false;
        }

        if (!data.getOtp().equals(otp)) {
            return false;
        }

        // OTP verified — remove it (one-time use)
        otpRepository.deleteById(phoneNumber);
        return true;
    }

    private String generateOtp() {
        return String.valueOf(100000 + random.nextInt(900000));
    }

    private void printOtp(String otp, String phoneNumber) {
        logger.info("========================================");
        logger.info("  OTP for {} = {}", phoneNumber, otp);
        logger.info("========================================");
        System.out.println("\n========================================");
        System.out.println("  OTP for " + phoneNumber + " = " + otp);
        System.out.println("========================================\n");
    }
}
