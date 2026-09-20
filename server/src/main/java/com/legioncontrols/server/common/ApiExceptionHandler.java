package com.legioncontrols.server.common;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.NoHandlerFoundException;

/**
 * Reproduces backend/src/middleware/errorHandler.js's exact JSON error contract so the React
 * frontend needs no changes when pointed at Spring instead of Express:
 *
 * <ul>
 *   <li>{@code {"error": "<message>"}} for a thrown {@link ApiException}, status from the exception.
 *   <li>An uncaught 500 never leaks the raw exception message — always {@code "Internal server
 *       error"} (plus a {@code detail} field outside the "prod" profile, matching Express's
 *       {@code NODE_ENV !== 'production'} behavior).
 *   <li>Unmatched routes: {@code 404 {"error": "Not found", "path": "<originalUrl>"}} — the one
 *       place the Express contract intentionally differs from the plain {@code {error}} shape used
 *       everywhere else, reproduced here for parity.
 * </ul>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private final boolean productionProfile;

    public ApiExceptionHandler(Environment environment) {
        this.productionProfile = environment.acceptsProfiles(org.springframework.core.env.Profiles.of("prod", "production"));
    }

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApiException(ApiException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", ex.getMessage());
        return ResponseEntity.status(ex.getStatusCode()).body(body);
    }

    @ExceptionHandler(NoHandlerFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNotFound(NoHandlerFoundException ex) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Not found");
        body.put("path", ex.getRequestURL());
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        String message = ex.getBindingResult().getFieldErrors().stream()
            .map(f -> f.getField() + " " + f.getDefaultMessage())
            .collect(Collectors.joining(", "));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message.isBlank() ? "Invalid request" : message);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleUncaught(Exception ex, HttpServletRequest request) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", "Internal server error");
        if (!productionProfile) {
            body.put("detail", String.valueOf(ex.getMessage()));
        }
        return ResponseEntity.internalServerError().body(body);
    }
}
