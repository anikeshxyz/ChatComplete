package com.chat.application.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    private static final String SECURITY_SCHEME_NAME = "bearerAuth";

    @Bean
    public OpenAPI chatAppOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Chat Application API")
                        .description("""
                                REST + WebSocket API for a real-time chat application.

                                **Features:**
                                - JWT-based authentication (register / login)
                                - Real-time 1-on-1 messaging via STOMP/WebSocket
                                - Group chat creation and messaging
                                - File & image sharing
                                - User presence (online/offline)
                                - Typing indicators & read receipts
                                - Video calling (WebRTC signalling)
                                """)
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Chat App Team")
                                .email("support@chatapp.local"))
                        .license(new License().name("MIT")))
                .servers(List.of(
                        new Server().url("http://localhost:3030").description("Local development server")))
                // Global security: every endpoint requires a Bearer token by default
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME))
                .components(new Components()
                        .addSecuritySchemes(SECURITY_SCHEME_NAME,
                                new SecurityScheme()
                                        .name(SECURITY_SCHEME_NAME)
                                        .type(SecurityScheme.Type.HTTP)
                                        .scheme("bearer")
                                        .bearerFormat("JWT")
                                        .description("Paste your JWT token (without 'Bearer ' prefix)")));
    }
}
