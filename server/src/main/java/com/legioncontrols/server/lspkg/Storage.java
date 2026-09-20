package com.legioncontrols.server.lspkg;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import org.springframework.stereotype.Component;

/**
 * Java port of backend/src/lib/lspkg/storage.js — staged/imported `.lspkg` bytes live on disk, not
 * in the database (Postgres is a poor fit for storing potentially-large binary blobs). Filenames are
 * always the package record's own generated UUID, never a caller-supplied name, so this module never
 * has to sanitize a hostile path.
 *
 * Defaults to the SAME directory the pre-migration Node backend used ({@code backend/.lspkg-staging}
 * relative to the repo root) so packages staged by either implementation during the strangler
 * transition remain readable — override with {@code LSPKG_STAGING_DIR} if needed.
 */
@Component
public class Storage {

    private Path stagingDir() {
        String override = System.getenv("LSPKG_STAGING_DIR");
        Path dir = override != null && !override.isBlank()
            ? Paths.get(override)
            : Paths.get("..", "backend", ".lspkg-staging");
        try {
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return dir;
    }

    public String writeStagedPackage(String packageRecordId, byte[] buffer) {
        Path filePath = stagingDir().resolve(packageRecordId + ".lspkg");
        try {
            Files.write(filePath, buffer);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return filePath.toAbsolutePath().toString();
    }

    public byte[] readStagedPackage(String filePath) {
        try {
            return Files.readAllBytes(Paths.get(filePath));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void deleteStagedPackage(String filePath) {
        try {
            Files.deleteIfExists(Paths.get(filePath));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
