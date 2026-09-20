package com.legioncontrols.server.common;

import org.jooq.JSONB;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

/** Small helpers for moving JSON between jOOQ's {@link JSONB} column type and Jackson trees. */
@Component
public class JsonUtil {

    private final ObjectMapper objectMapper;

    public JsonUtil(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode toJsonNode(JSONB jsonb) {
        if (jsonb == null) return null;
        return objectMapper.readTree(jsonb.data());
    }

    public JSONB toJsonb(JsonNode node) {
        return JSONB.jsonb(objectMapper.writeValueAsString(node));
    }

    public ObjectNode newObject() {
        return objectMapper.createObjectNode();
    }

    public ArrayNode newArray() {
        return objectMapper.createArrayNode();
    }

    /** Deep copy, matching the Node helper's cloneJson (JSON.parse(JSON.stringify(...))). */
    public JsonNode clone(JsonNode node) {
        if (node == null) return null;
        return node.deepCopy();
    }

    public JsonNode readTree(String json) {
        return objectMapper.readTree(json);
    }
}
