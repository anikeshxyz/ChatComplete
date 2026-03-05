package com.chat.application.service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;
import reactor.core.publisher.Mono;
import reactor.util.retry.Retry;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class GeminiApiClient {

    private static final Logger logger = LoggerFactory.getLogger(GeminiApiClient.class);

    @Value("${gemini.api.key:default_key}")
    private String apiKey;

    private final WebClient webClient;

    private static final List<String> MODELS = List.of(
            "gemini-2.0-flash",
            "gemini-2.5-flash",
            "gemma-3-27b-it",
            "gemma-3-12b-it",
            "gemma-3-4b-it");

    public GeminiApiClient(WebClient.Builder webClientBuilder) {
        this.webClient = webClientBuilder
                .baseUrl("https://generativelanguage.googleapis.com/v1beta/models/")
                .build();
    }

    public String generateContent(String prompt) {
        AtomicInteger modelIndex = new AtomicInteger(0);
        return executeWithFallback(prompt, modelIndex).block();
    }

    private Mono<String> executeWithFallback(String prompt, AtomicInteger modelIndex) {
        if (modelIndex.get() >= MODELS.size()) {
            logger.error("All Gemini API models exhausted or failed.");
            return Mono.just("{\"error\": \"Failed to generate content after exhausting all models and retries.\"}");
        }

        String currentModel = MODELS.get(modelIndex.get());
        logger.info("Calling Gemini API with model: {}", currentModel);

        Map<String, Object> requestBody = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(Map.of("text", prompt)))));

        return webClient.post()
                .uri(uriBuilder -> uriBuilder
                        .path(currentModel + ":generateContent")
                        .queryParam("key", apiKey)
                        .build())
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .bodyValue(requestBody)
                .retrieve()
                .onStatus(HttpStatusCode::isError, response -> {
                    HttpStatus status = (HttpStatus) response.statusCode();
                    return response.bodyToMono(String.class).flatMap(body -> {
                        boolean isRetryableError = status == HttpStatus.SERVICE_UNAVAILABLE
                                || status == HttpStatus.TOO_MANY_REQUESTS
                                || body.contains("MODEL_CAPACITY_EXHAUSTED")
                                || body.contains("UNAVAILABLE");

                        if (isRetryableError) {
                            return Mono.error(
                                    new GeminiCapacityException("Capacity exhausted or too many requests", status));
                        }
                        return Mono.error(new WebClientResponseException(
                                status.value(), status.getReasonPhrase(),
                                response.headers().asHttpHeaders(), body.getBytes(), null));
                    });
                })
                .bodyToMono(String.class)
                .map(this::extractTextFromResponse)
                .timeout(Duration.ofSeconds(60))
                .retryWhen(Retry.backoff(5, Duration.ofSeconds(2))
                        .maxBackoff(Duration.ofSeconds(32))
                        .filter(throwable -> throwable instanceof GeminiCapacityException
                                || throwable instanceof TimeoutException
                                || throwable instanceof java.net.SocketTimeoutException)
                        .doBeforeRetry(retrySignal -> {
                            logger.warn("Retrying Gemini API call with model {}. Attempt {} of 5.",
                                    currentModel, retrySignal.totalRetries() + 1);
                        }))
                .onErrorResume(throwable -> {
                    logger.error("Error calling Gemini API with model {}: {}", currentModel, throwable.getMessage());
                    modelIndex.incrementAndGet();
                    if (modelIndex.get() < MODELS.size()) {
                        logger.info("Falling back to model: {}", MODELS.get(modelIndex.get()));
                        return executeWithFallback(prompt, modelIndex);
                    }
                    logger.error("All Gemini API models exhausted or failed.");
                    return Mono.just(
                            "{\"error\": \"Failed to generate content after exhausting all models and retries.\"}");
                });
    }

    private String extractTextFromResponse(String rawJson) {
        try {
            com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
            com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(rawJson);
            if (root.has("error")) {
                return rawJson;
            }
            com.fasterxml.jackson.databind.JsonNode candidates = root.path("candidates");
            if (candidates.isArray() && candidates.size() > 0) {
                com.fasterxml.jackson.databind.JsonNode parts = candidates.get(0).path("content").path("parts");
                if (parts.isArray() && parts.size() > 0) {
                    return parts.get(0).path("text").asText();
                }
            }
            logger.error("Unexpected Gemini API response structure: {}", rawJson);
            return "{\"error\": \"Unexpected response format.\"}";
        } catch (Exception e) {
            logger.error("Failed to parse Gemini API response", e);
            return "{\"error\": \"Failed to parse response.\"}";
        }
    }

    private static class GeminiCapacityException extends RuntimeException {
        public GeminiCapacityException(String message, HttpStatus status) {
            super(message);
        }
    }
}
