package com.legioncontrols.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code legion.bacnet-commissioning.*} in application.yml — the isolated Node BACnet
 * commissioning process (backend/src/bacnetCommissioningServer.js), a separate OS process/failure
 * domain from both this Server and the Legion Runtime process. See
 * {@link com.legioncontrols.server.bacnet.BacnetCommissioningClient} for why this stays Node rather
 * than being rewritten in Java (the proven, working {@code node-bacnet} library) and why it is no
 * longer part of keeping the full Express Legion Server alive as a production dependency.
 */
@ConfigurationProperties(prefix = "legion.bacnet-commissioning")
public class BacnetCommissioningClientProperties {

    /** Base URL of the standalone BACnet commissioning process's HTTP API. */
    private String baseUrl = "http://127.0.0.1:4300";

    private int connectTimeoutMs = 2000;

    private int requestTimeoutMs = 15000;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
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
