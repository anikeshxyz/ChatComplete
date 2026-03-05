package com.chat.application.security;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Servlet filter that sanitizes query parameters and TEXT-based JSON request
 * bodies to strip XSS attack vectors before they reach any controller.
 *
 * Completely bypassed (chain.doFilter with original request) for:
 * - multipart/form-data → binary file data; Spring parses via getParts(), not
 * getInputStream()
 * - WebSocket / SockJS → STOMP frames carry JWTs; any mutation would break auth
 *
 * For JSON / form-urlencoded requests:
 * - Request parameters sanitized via getParameter() / getParameterValues()
 * - Plain-text request body cached, cleaned, and re-exposed as InputStream
 */
@Component
@Order(1)
public class XssFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpReq = (HttpServletRequest) request;
        String contentType = httpReq.getContentType();
        String uri = httpReq.getRequestURI();

        // Pass multipart and WebSocket requests through completely unwrapped.
        // Wrapping these breaks Spring's multipart resolver (getParts()) and
        // would corrupt JWT tokens inside STOMP/SockJS frames.
        if (isMultipart(contentType) || isWebSocketPath(uri)) {
            chain.doFilter(request, response);
            return;
        }

        chain.doFilter(new XssRequestWrapper(httpReq), response);
    }

    private static boolean isMultipart(String contentType) {
        return contentType != null && contentType.toLowerCase().startsWith("multipart/");
    }

    private static boolean isWebSocketPath(String uri) {
        return uri != null && (uri.contains("/chat") || uri.contains("/ws"));
    }

    // ── Wrapper (only used for JSON / form-urlencoded requests) ─────────────
    public static class XssRequestWrapper extends HttpServletRequestWrapper {

        /**
         * Patterns that are dangerous in HTML/JS context.
         * '/' is intentionally excluded — it is safe in text/attr contexts and
         * escaping it would corrupt URLs, JWTs, and file paths.
         */
        private static final Pattern[] DANGEROUS = {
                Pattern.compile("<script[^>]*>.*?</script>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL),
                Pattern.compile("</?script[^>]*>", Pattern.CASE_INSENSITIVE),
                Pattern.compile("javascript\\s*:", Pattern.CASE_INSENSITIVE),
                Pattern.compile("vbscript\\s*:", Pattern.CASE_INSENSITIVE),
                Pattern.compile("data\\s*:\\s*text/html", Pattern.CASE_INSENSITIVE),
                Pattern.compile("on\\w+\\s*=\\s*[\"']?[^\"'>]*[\"']?", Pattern.CASE_INSENSITIVE),
                Pattern.compile("expression\\s*\\(", Pattern.CASE_INSENSITIVE),
                Pattern.compile("<!--.*?-->", Pattern.DOTALL),
                Pattern.compile("<\\s*(iframe|object|embed|applet|link|meta)[^>]*>",
                        Pattern.CASE_INSENSITIVE),
        };

        private final byte[] sanitizedBody;

        public XssRequestWrapper(HttpServletRequest request) throws IOException {
            super(request);
            byte[] rawBody = request.getInputStream().readAllBytes();
            String bodyText = new String(rawBody, StandardCharsets.UTF_8);
            this.sanitizedBody = sanitize(bodyText).getBytes(StandardCharsets.UTF_8);
        }

        // ── Parameter overrides ──────────────────────────────────────────────
        @Override
        public String getParameter(String name) {
            String value = super.getParameter(name);
            return value == null ? null : sanitize(value);
        }

        @Override
        public String[] getParameterValues(String name) {
            String[] values = super.getParameterValues(name);
            if (values == null)
                return null;
            String[] cleaned = new String[values.length];
            for (int i = 0; i < values.length; i++) {
                cleaned[i] = values[i] == null ? null : sanitize(values[i]);
            }
            return cleaned;
        }

        // ── Body override (JSON payloads) ────────────────────────────────────
        @Override
        public ServletInputStream getInputStream() {
            final ByteArrayInputStream bais = new ByteArrayInputStream(sanitizedBody);
            return new ServletInputStream() {
                @Override
                public boolean isFinished() {
                    return bais.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener l) {
                }

                @Override
                public int read() {
                    return bais.read();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            return new BufferedReader(
                    new InputStreamReader(getInputStream(), StandardCharsets.UTF_8));
        }

        // ── Sanitize: strip dangerous patterns from plain text ───────────────
        public static String sanitize(String input) {
            if (input == null || input.isEmpty())
                return input;
            String result = input;
            for (Pattern p : DANGEROUS) {
                result = p.matcher(result).replaceAll("");
            }
            return result;
        }
    }
}
