package com.chat.application.controller;

import com.chat.application.response.UserResponse;
import com.chat.application.service.SearchService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Search", description = "Search for users by name or username")
@CrossOrigin(origins = "*")
@RequestMapping("${app.title}")
@RestController
public class SearchController {

    private final SearchService searchService;

    public SearchController(SearchService searchService) {
        this.searchService = searchService;
    }

    @Operation(summary = "Search users", description = "Case-insensitive search by username, first name, or last name. Returns all matching users.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Matching users list (may be empty)"),
            @ApiResponse(responseCode = "401", description = "Unauthorized", content = @Content)
    })
    @GetMapping("/search-user")
    public ResponseEntity<?> searchForUser(
            @Parameter(description = "Search keyword (min 1 character)", required = true, example = "alice") @RequestParam String name) {
        List<UserResponse> users = searchService.getUserFromRepoByKeyword(name);
        return ResponseEntity.ok(users);
    }
}
