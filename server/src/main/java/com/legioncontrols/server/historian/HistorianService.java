package com.legioncontrols.server.historian;

import com.legioncontrols.server.common.JsonUtil;
import com.legioncontrols.server.jooq.generated.tables.records.PointhistorysampleRecord;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.jooq.DSLContext;
import org.jooq.Record2;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import tools.jackson.databind.JsonNode;

import static com.legioncontrols.server.jooq.generated.tables.Pointhistorysample.POINTHISTORYSAMPLE;
import static com.legioncontrols.server.jooq.generated.tables.Trendassignment.TRENDASSIGNMENT;
import static com.legioncontrols.server.jooq.generated.tables.Trenddefinition.TRENDDEFINITION;

/**
 * Java equivalent of backend/src/lib/historian.js (LC-ARCH-001 D-010: stale/offline points remain
 * represented in trends; history is never fabricated). A point only earns
 * {@code PointHistorySample} rows because an enabled TrendAssignment on an enabled
 * TrendDefinition says so — being SIM-mapped/polled is necessary but not sufficient.
 *
 * The coverage/interval/retention cache and the per-point last-recorded-at throttle are
 * process-local, exactly as in Node — a restart just allows one extra sample immediately after
 * startup, never fewer, and never loses data.
 */
@Service
public class HistorianService {

    private static final Logger log = LoggerFactory.getLogger(HistorianService.class);

    private static final Set<String> QUALITIES = Set.of("ONLINE", "OFFLINE", "STALE");
    private static final int DEFAULT_RETENTION_DAYS = 30;
    private static final int DEFAULT_SAMPLE_INTERVAL_SECONDS = 60;
    private static final int MIN_SAMPLE_INTERVAL_SECONDS = 10;
    private static final int MAX_SAMPLES_PER_POINT = 1500;

    private static final Map<String, Long> RANGE_WINDOWS_MS = Map.of(
        "1h", 60 * 60 * 1000L,
        "24h", 24 * 60 * 60 * 1000L,
        "7d", 7 * 24 * 60 * 60 * 1000L,
        "30d", 30L * 24 * 60 * 60 * 1000L
    );

    private final DSLContext dsl;
    private final JsonUtil json;

    private volatile Set<String> coveredPointIds = Set.of();
    private volatile Map<String, Long> intervalMsByPoint = Map.of();
    private volatile Map<String, Integer> retentionDaysByPoint = Map.of();
    private final Map<String, Long> lastRecordedAtMs = new ConcurrentHashMap<>();

    public HistorianService(DSLContext dsl, JsonUtil json) {
        this.dsl = dsl;
        this.json = json;
        refreshHistorianConfig();
    }

    public static String normalizeQuality(String raw) {
        String q = raw != null ? raw.trim().toUpperCase() : "";
        return QUALITIES.contains(q) ? q : "ONLINE";
    }

    public static long windowMsForRange(String range) {
        String key = range != null ? range.trim().toLowerCase() : "";
        return RANGE_WINDOWS_MS.getOrDefault(key, RANGE_WINDOWS_MS.get("1h"));
    }

    private static int normalizeSampleIntervalSeconds(Integer raw) {
        if (raw == null || raw <= 0) return DEFAULT_SAMPLE_INTERVAL_SECONDS;
        return Math.max(MIN_SAMPLE_INTERVAL_SECONDS, raw);
    }

    /** One snapshot query for coverage + interval + retention, so the three facts can never disagree. */
    @Scheduled(fixedRate = 300_000)
    public synchronized void refreshHistorianConfig() {
        var rows = dsl.select(TRENDASSIGNMENT.RESOLVEDMAPPINGS, TRENDDEFINITION.SAMPLEINTERVAL, TRENDDEFINITION.RETENTIONDAYS)
            .from(TRENDASSIGNMENT)
            .join(TRENDDEFINITION).on(TRENDDEFINITION.ID.eq(TRENDASSIGNMENT.DEFINITIONID))
            .where(TRENDASSIGNMENT.ENABLED.isTrue(), TRENDDEFINITION.ENABLED.isTrue())
            .fetch();

        Set<String> nextCovered = new HashSet<>();
        Map<String, Long> nextInterval = new HashMap<>();
        Map<String, Integer> nextRetention = new HashMap<>();

        for (var row : rows) {
            JsonNode mappings = row.value1() != null ? json.toJsonNode(row.value1()) : null;
            if (mappings == null || !mappings.isObject()) continue;

            long intervalMs = normalizeSampleIntervalSeconds(row.value2()) * 1000L;
            Integer retentionDays = row.value3() != null ? row.value3() : DEFAULT_RETENTION_DAYS;

            var fields = mappings.properties();
            for (var entry : fields) {
                JsonNode value = entry.getValue();
                if (value == null || !value.isTextual() || value.asText().isBlank()) continue;
                String pointId = value.asText();
                nextCovered.add(pointId);
                Long prevInterval = nextInterval.get(pointId);
                if (prevInterval == null || intervalMs < prevInterval) nextInterval.put(pointId, intervalMs);
                Integer prevRetention = nextRetention.get(pointId);
                if (prevRetention == null || retentionDays > prevRetention) nextRetention.put(pointId, retentionDays);
            }
        }

        coveredPointIds = nextCovered;
        intervalMsByPoint = nextInterval;
        retentionDaysByPoint = nextRetention;
        lastRecordedAtMs.keySet().removeIf(pointId -> !nextCovered.contains(pointId));
    }

    public boolean isPointCovered(String pointId) {
        return coveredPointIds.contains(pointId);
    }

    /**
     * Synchronous gate: rejects outright if the point has no enabled trend assignment. When
     * covered, the ConcurrentHashMap.compute() call below makes the read-then-write of
     * lastRecordedAtMs atomic per key, so a SIM poll and a manual update racing for the same point
     * cannot both win within the same interval window.
     */
    public boolean shouldRecordSample(String pointId, long timestampMs) {
        if (!coveredPointIds.contains(pointId)) return false;
        long minMs = intervalMsByPoint.getOrDefault(pointId, DEFAULT_SAMPLE_INTERVAL_SECONDS * 1000L);
        boolean[] shouldRecord = {false};
        lastRecordedAtMs.compute(pointId, (id, last) -> {
            if (last == null || timestampMs - last >= minMs) {
                shouldRecord[0] = true;
                return timestampMs;
            }
            return last;
        });
        return shouldRecord[0];
    }

    public record SampleEntry(String pointId, String value, String quality, LocalDateTime timestamp) {
    }

    public void recordSample(SampleEntry entry) {
        PointhistorysampleRecord record = dsl.newRecord(POINTHISTORYSAMPLE);
        record.setId(UUID.randomUUID().toString());
        record.setPointid(entry.pointId());
        record.setValue(entry.value());
        record.setQuality(normalizeQuality(entry.quality()));
        record.setTimestamp(entry.timestamp() != null ? entry.timestamp() : LocalDateTime.now());
        record.insert();
    }

    public record HistorySamplePoint(String timestamp, String value, String quality) {
    }

    /** Historian read path for the operator trend chart — never fabricates or backfills. */
    public Map<String, List<HistorySamplePoint>> getHistoryForPointIds(List<String> pointIds, String range) {
        List<String> ids = pointIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
        Map<String, List<HistorySamplePoint>> out = new LinkedHashMap<>();
        for (String id : ids) out.put(id, new ArrayList<>());
        if (ids.isEmpty()) return out;

        long windowMs = windowMsForRange(range);
        LocalDateTime since = LocalDateTime.now().minus(windowMs, ChronoUnit.MILLIS);

        List<PointhistorysampleRecord> rows = dsl.selectFrom(POINTHISTORYSAMPLE)
            .where(POINTHISTORYSAMPLE.POINTID.in(ids), POINTHISTORYSAMPLE.TIMESTAMP.ge(since))
            .orderBy(POINTHISTORYSAMPLE.TIMESTAMP.asc())
            .fetch();

        Map<String, List<HistorySamplePoint>> byPoint = new HashMap<>();
        for (String id : ids) byPoint.put(id, new ArrayList<>());
        for (PointhistorysampleRecord row : rows) {
            byPoint.get(row.getPointid()).add(new HistorySamplePoint(
                row.getTimestamp().atZone(java.time.ZoneOffset.UTC).toInstant().toString(),
                row.getValue(),
                row.getQuality()
            ));
        }
        for (String id : ids) out.put(id, decimateSamples(byPoint.get(id), MAX_SAMPLES_PER_POINT));
        return out;
    }

    /** Decimation, never aggregation/fabrication — a real kept row every Nth step, plus the last row always kept. */
    public static List<HistorySamplePoint> decimateSamples(List<HistorySamplePoint> rows, int maxSamples) {
        if (rows == null) return List.of();
        if (rows.size() <= maxSamples) return rows;
        int stride = (int) Math.ceil((double) rows.size() / maxSamples);
        List<HistorySamplePoint> out = new ArrayList<>();
        for (int i = 0; i < rows.size(); i += stride) out.add(rows.get(i));
        HistorySamplePoint last = rows.get(rows.size() - 1);
        if (out.isEmpty() || !out.get(out.size() - 1).equals(last)) out.add(last);
        return out;
    }

    /** Runs on its own long-period timer, never inside a per-point-update code path. */
    @Scheduled(fixedRate = 6 * 60 * 60 * 1000L)
    public void runRetentionCleanup() {
        Map<Integer, List<String>> buckets = new HashMap<>();
        List<String> customPointIds = new ArrayList<>();
        for (var e : retentionDaysByPoint.entrySet()) {
            if (e.getValue() == DEFAULT_RETENTION_DAYS) continue;
            buckets.computeIfAbsent(e.getValue(), k -> new ArrayList<>()).add(e.getKey());
            customPointIds.add(e.getKey());
        }

        long now = System.currentTimeMillis();
        int deleted = 0;
        for (var bucket : buckets.entrySet()) {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(bucket.getKey());
            deleted += dsl.deleteFrom(POINTHISTORYSAMPLE)
                .where(POINTHISTORYSAMPLE.POINTID.in(bucket.getValue()), POINTHISTORYSAMPLE.TIMESTAMP.lt(cutoff))
                .execute();
        }

        LocalDateTime defaultCutoff = LocalDateTime.now().minusDays(DEFAULT_RETENTION_DAYS);
        deleted += customPointIds.isEmpty()
            ? dsl.deleteFrom(POINTHISTORYSAMPLE).where(POINTHISTORYSAMPLE.TIMESTAMP.lt(defaultCutoff)).execute()
            : dsl.deleteFrom(POINTHISTORYSAMPLE)
                .where(POINTHISTORYSAMPLE.TIMESTAMP.lt(defaultCutoff), POINTHISTORYSAMPLE.POINTID.notIn(customPointIds))
                .execute();
        if (deleted > 0) {
            log.info("[historian] retention cleanup deleted {} rows", deleted);
        }
    }
}
