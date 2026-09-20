package com.legioncontrols.server;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;
import org.testcontainers.postgresql.PostgreSQLContainer;

/**
 * Applies the EXISTING Prisma migration SQL files (backend/prisma/migrations/*&#47;migration.sql,
 * in chronological/lexicographic order) directly to a fresh Testcontainers Postgres instance, so
 * integration tests run against the real, current schema — never a hand-maintained test-only copy
 * that could drift from it. This is read-only with respect to the actual repository: it only reads
 * the .sql files, never modifies them, and only ever runs against an ephemeral test container.
 *
 * Mirrors the "fresh database can be provisioned deterministically" half of the Prisma -> Flyway
 * transition strategy documented in
 * src/main/resources/db/migration/README.md — Spring's own Flyway then baselines on top of the
 * schema this creates, exactly as it would for a real freshly-provisioned database.
 */
final class PrismaSchemaInitializer {

    private PrismaSchemaInitializer() {
    }

    static void apply(PostgreSQLContainer container) {
        Path migrationsDir = findMigrationsDir();
        List<Path> migrationFiles;
        try (var stream = Files.walk(migrationsDir, 2)) {
            migrationFiles = stream
                .filter(p -> p.getFileName().toString().equals("migration.sql"))
                .sorted()
                .toList();
        } catch (IOException e) {
            throw new IllegalStateException("Could not list Prisma migrations under " + migrationsDir, e);
        }

        try (Connection connection = DriverManager.getConnection(container.getJdbcUrl(), container.getUsername(), container.getPassword());
             Statement statement = connection.createStatement()) {
            for (Path file : migrationFiles) {
                String sql = Files.readString(file);
                if (sql.isBlank()) continue;
                statement.execute(sql);
            }
        } catch (Exception e) {
            throw new IllegalStateException("Failed applying Prisma migrations to test container", e);
        }
    }

    private static Path findMigrationsDir() {
        // Test JVM working directory is server/ — migrations live at ../backend/prisma/migrations.
        Path fromServerDir = Path.of("..", "backend", "prisma", "migrations").normalize();
        if (Files.isDirectory(fromServerDir)) return fromServerDir;
        Path fromRepoRoot = Path.of("backend", "prisma", "migrations").normalize();
        if (Files.isDirectory(fromRepoRoot)) return fromRepoRoot;
        throw new IllegalStateException("Could not locate backend/prisma/migrations from " + Path.of("").toAbsolutePath());
    }
}
