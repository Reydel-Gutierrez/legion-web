package com.legioncontrols.server.common;

/**
 * Java equivalent of the Node backend's {@code HttpError} (backend/src/lib/httpError.js). Thrown
 * anywhere a request should fail with a specific HTTP status and a client-facing message; caught
 * centrally by {@link ApiExceptionHandler}, which reproduces the Express error-response contract
 * ({@code {"error": "<message>"}}) exactly, so the frontend needs no changes to consume either
 * backend.
 */
public class ApiException extends RuntimeException {

    private final int statusCode;

    public ApiException(int statusCode, String message) {
        super(message);
        this.statusCode = statusCode;
    }

    public int getStatusCode() {
        return statusCode;
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, message);
    }

    public static ApiException badRequest(String message) {
        return new ApiException(400, message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(409, message);
    }

    public static ApiException unprocessable(String message) {
        return new ApiException(422, message);
    }

    public static ApiException badGateway(String message) {
        return new ApiException(502, message);
    }

    public static ApiException serviceUnavailable(String message) {
        return new ApiException(503, message);
    }
}
