package com.legioncontrols.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code legion.runtime.*} in application.yml — mirrors backend/src/config/env.ts's
 * LEGION_RUNTIME_URL / RUNTIME_INTERNAL_TOKEN / RUNTIME_REQUEST_TIMEOUT_MS exactly, so this Server
 * and the Node Server can point at the same running Legion Runtime process unchanged.
 */
@ConfigurationProperties(prefix = "legion.runtime")
public class RuntimeClientProperties {

    /** Base URL of the standalone Legion Runtime process's internal HTTP API. */
    private String baseUrl = "http://127.0.0.1:4200";

    /** Optional shared-secret header value; null/blank means no token is sent. */
    private String internalToken;

    private int connectTimeoutMs = 2000;

    private int requestTimeoutMs = 5000;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getInternalToken() {
        return internalToken;
    }

    public void setInternalToken(String internalToken) {
        this.internalToken = internalToken;
    }

    public int getConnectTimeoutMs() {
        return connectTimeoutMs;
    }

    public void setConnectTimeoutMs(int connectTimeoutMs) {
        this.connectTimeoutMs = connectTimeoutMs;
    }

    public int getRequestTimeoutMs() {
        return requestTimeoutMs;
    }

    public void setRequestTimeoutMs(int requestTimeoutMs) {
        this.requestTimeoutMs = requestTimeoutMs;
    }
}
