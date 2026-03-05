package com.chat.application.config;

import com.chat.application.enums.Role;
import com.chat.application.model.User;
import com.chat.application.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDateTime;

@Configuration
public class SystemUserInitializer {

    @Bean
    public CommandLineRunner initSystemUsers(UserRepository userRepository) {
        return args -> {
            if (userRepository.findByUsername("AI Assistant").isEmpty()) {
                User aiAssistant = new User();
                aiAssistant.setFirstname("AI");
                aiAssistant.setLastname("Assistant");
                aiAssistant.setUsername("AI Assistant");
                aiAssistant.setEmail("ai.assistant@chatapp.com");
                aiAssistant.setAbout("Your AI powered assistant.");
                aiAssistant.setRole(Role.USER); // Or a specific SYSTEM role if defined
                aiAssistant.setCreatedAt(LocalDateTime.now());
                aiAssistant.setEnabled(true);
                aiAssistant.setPassword("SYSTEM_USER_NO_LOGIN"); // Prevent normal login

                userRepository.save(aiAssistant);
                System.out.println("System user 'AI Assistant' created successfully.");
            }
        };
    }
}
