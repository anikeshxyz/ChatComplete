package com.chat.application.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/**
 * MVC configuration — maps the /uploads/** URL path to the physical
 * uploads directory so profile pictures and chat files are served correctly.
 *
 * The upload directory is configured in application.properties:
 * file.upload-dir=${user.home}/Documents/Aahan/project/chat-app-server/uploads
 *
 * Files are then accessible at:
 * http://localhost:3030/uploads/{filename}
 */
@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    @Value("${file.upload-dir}")
    private String uploadDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Normalize the path: ensure it ends with '/' and has 'file:' prefix
        String location = uploadDir.trim();
        if (!location.endsWith("/")) {
            location = location + "/";
        }
        if (!location.startsWith("file:")) {
            location = "file:" + location;
        }

        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(location)
                .setCachePeriod(3600); // cache 1 hour in browser
    }
}
