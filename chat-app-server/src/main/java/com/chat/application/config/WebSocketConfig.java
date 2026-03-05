package com.chat.application.config;

import com.chat.application.security.AuthChannelInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * WebSocket / STOMP configuration.
 *
 * Broker: RabbitMQ STOMP relay (replaces the in-memory SimpleBroker).
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │ Browser ──SockJS──▶ /chat ──STOMP──▶ Spring ──TCP──▶ RabbitMQ │
 * │ ◀──────────────┘ │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Why RabbitMQ?
 * • Messages survive app restarts (durable queues/topics).
 * • Multiple app instances share the same broker → horizontal scaling.
 * • /queue (point-to-point) and /topic (pub-sub) both route through RMQ.
 *
 * Requires: RabbitMQ with the rabbitmq_stomp plugin enabled (port 61613).
 * Run: docker-compose up -d (see docker-compose.yml).
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final AuthChannelInterceptor authChannelInterceptor;

    @Value("${rabbitmq.stomp.host:localhost}")
    private String stompHost;

    @Value("${rabbitmq.stomp.port:61613}")
    private int stompPort;

    @Value("${rabbitmq.stomp.login:guest}")
    private String stompLogin;

    @Value("${rabbitmq.stomp.passcode:guest}")
    private String stompPasscode;

    public WebSocketConfig(AuthChannelInterceptor authChannelInterceptor) {
        this.authChannelInterceptor = authChannelInterceptor;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // ── STOMP Relay → RabbitMQ ─────────────────────────────────────────
        registry.enableStompBrokerRelay("/queue", "/topic")
                .setRelayHost(stompHost)
                .setRelayPort(stompPort)
                .setClientLogin(stompLogin)
                .setClientPasscode(stompPasscode)
                .setSystemLogin(stompLogin)
                .setSystemPasscode(stompPasscode)
                // Heartbeat: broker → client every 10 s, client → broker every 10 s
                .setSystemHeartbeatSendInterval(10_000)
                .setSystemHeartbeatReceiveInterval(10_000);

        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/chat")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authChannelInterceptor);
    }
}