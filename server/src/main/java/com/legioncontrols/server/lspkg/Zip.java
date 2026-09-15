package com.legioncontrols.server.lspkg;

import java.util.ArrayList;
import java.util.List;

/**
 * Java port of backend/src/lib/lspkg/zip.js — a minimal, dependency-free, deterministic ZIP
 * container reader/writer. Entries are stored uncompressed (method 0 / STORE) and every entry
 * timestamp is pinned to a fixed DOS date (1980-01-01) so two builds from identical logical content
 * never differ because of wall-clock time (LC-ARCH-002 §3, §12: "A validated project builds a
 * deterministic .lspkg"). Do not change the on-disk format here — it must stay byte-compatible with
 * whatever the pre-migration Node implementation ever produced/consumed.
 */
public final class Zip {

    private Zip() {
    }

    private static final long LOCAL_FILE_HEADER_SIG = 0x04034b50L;
    private static final long CENTRAL_DIR_HEADER_SIG = 0x02014b50L;
    private static final long END_OF_CENTRAL_DIR_SIG = 0x06054b50L;
    private static final int FIXED_DOS_DATE = 0x21; // 1980-01-01
    private static final int FIXED_DOS_TIME = 0x00;

    private static final int[] CRC_TABLE = buildCrcTable();

    private static int[] buildCrcTable() {
        int[] table = new int[256];
        for (int n = 0; n < 256; n++) {
            int c = n;
            for (int k = 0; k < 8; k++) {
                c = (c & 1) != 0 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
            }
            table[n] = c;
        }
        return table;
    }

    public static long crc32(byte[] buf) {
        int crc = 0xffffffff;
        for (byte b : buf) {
            crc = CRC_TABLE[(crc ^ b) & 0xff] ^ (crc >>> 8);
        }
        return (long) (crc ^ 0xffffffff) & 0xffffffffL;
    }

    public record Entry(String name, byte[] data) {
    }

    public static class ZipError extends RuntimeException {
        public ZipError(String message) {
            super(message);
        }
    }

    /** names must be path-safe, forward-slash, relative — validated by the caller (PackageBuilder). */
    public static byte[] buildZip(List<Entry> entries) {
        List<byte[]> localChunks = new ArrayList<>();
        List<byte[]> centralChunks = new ArrayList<>();
        long offset = 0;

        for (Entry entry : entries) {
            byte[] nameBuf = entry.name().getBytes(java.nio.charset.StandardCharsets.UTF_8);
            byte[] data = entry.data();
            long crc = crc32(data);
            int size = data.length;

            ByteWriter local = new ByteWriter(30);
            local.u32(LOCAL_FILE_HEADER_SIG);
            local.u16(20); // version needed
            local.u16(0); // flags
            local.u16(0); // method: STORE
            local.u16(FIXED_DOS_TIME);
            local.u16(FIXED_DOS_DATE);
            local.u32(crc);
            local.u32(size);
            local.u32(size);
            local.u16(nameBuf.length);
            local.u16(0); // extra field length
            localChunks.add(local.bytes());
            localChunks.add(nameBuf);
            localChunks.add(data);

            ByteWriter central = new ByteWriter(46);
            central.u32(CENTRAL_DIR_HEADER_SIG);
            central.u16(20); // version made by
            central.u16(20); // version needed
            central.u16(0); // flags
            central.u16(0); // method
            central.u16(FIXED_DOS_TIME);
            central.u16(FIXED_DOS_DATE);
            central.u32(crc);
            central.u32(size);
            central.u32(size);
            central.u16(nameBuf.length);
            central.u16(0); // extra length
            central.u16(0); // comment length
            central.u16(0); // disk number start
            central.u16(0); // internal attrs
            central.u32(0); // external attrs
            central.u32(offset); // relative offset of local header
            centralChunks.add(central.bytes());
            centralChunks.add(nameBuf);

            offset += 30 + nameBuf.length + data.length;
        }

        long centralDirStart = offset;
        byte[] centralDir = concat(centralChunks);
        int centralDirSize = centralDir.length;

        ByteWriter end = new ByteWriter(22);
        end.u32(END_OF_CENTRAL_DIR_SIG);
        end.u16(0); // disk number
        end.u16(0); // disk with central dir
        end.u16(entries.size());
        end.u16(entries.size());
        end.u32(centralDirSize);
        end.u32(centralDirStart);
        end.u16(0); // comment length

        List<byte[]> all = new ArrayList<>(localChunks);
        all.add(centralDir);
        all.add(end.bytes());
        return concat(all);
    }

    /** Rejects zip-slip / path traversal / absolute paths. */
    public static boolean isPathSafe(String name) {
        if (name == null || name.isEmpty()) return false;
        if (name.contains("\\")) return false;
        if (name.startsWith("/") || name.matches("^[a-zA-Z]:.*")) return false;
        for (String seg : name.split("/", -1)) {
            if (seg.isEmpty() || seg.equals(".") || seg.equals("..")) return false;
        }
        return true;
    }

    public record Limits(int maxFiles, long maxTotalBytes, long maxEntryBytes) {
        public static Limits defaults() {
            return new Limits(500, 200L * 1024 * 1024, 64L * 1024 * 1024);
        }
    }

    public static List<Entry> readZip(byte[] buffer, Limits limits) {
        if (buffer == null || buffer.length < 22) {
            throw new ZipError("Not a valid ZIP archive (too small)");
        }
        ByteReader r = new ByteReader(buffer);

        long eocdOffset = -1;
        int maxBack = Math.min(buffer.length, 22 + 65536);
        for (int i = buffer.length - 22; i >= buffer.length - maxBack; i--) {
            if (i < 0) break;
            if (r.u32(i) == END_OF_CENTRAL_DIR_SIG) {
                eocdOffset = i;
                break;
            }
        }
        if (eocdOffset == -1) throw new ZipError("End of central directory record not found");

        int totalEntries = r.u16((int) eocdOffset + 10);
        long centralDirSize = r.u32((int) eocdOffset + 12);
        long centralDirOffset = r.u32((int) eocdOffset + 16);

        if (totalEntries > limits.maxFiles()) {
            throw new ZipError("Package contains " + totalEntries + " files, exceeding the limit of " + limits.maxFiles());
        }
        if (centralDirOffset + centralDirSize > eocdOffset) {
            throw new ZipError("Corrupt central directory (out of bounds)");
        }

        List<Entry> entries = new ArrayList<>();
        long totalBytes = 0;
        long pos = centralDirOffset;
        for (int i = 0; i < totalEntries; i++) {
            if (r.u32((int) pos) != CENTRAL_DIR_HEADER_SIG) {
                throw new ZipError("Corrupt central directory entry");
            }
            int method = r.u16((int) pos + 10);
            long crcExpected = r.u32((int) pos + 16);
            long compSize = r.u32((int) pos + 20);
            long uncompSize = r.u32((int) pos + 24);
            int nameLen = r.u16((int) pos + 28);
            int extraLen = r.u16((int) pos + 30);
            int commentLen = r.u16((int) pos + 32);
            long localOffset = r.u32((int) pos + 42);
            String name = new String(buffer, (int) pos + 46, nameLen, java.nio.charset.StandardCharsets.UTF_8);
            pos += 46 + nameLen + extraLen + commentLen;

            if (method != 0) {
                throw new ZipError("Unsupported compression method (" + method + ") for entry \"" + name + "\" — only STORE is accepted");
            }
            if (!isPathSafe(name)) {
                throw new ZipError("Unsafe or path-traversal entry name rejected: \"" + name + "\"");
            }
            if (uncompSize > limits.maxEntryBytes()) {
                throw new ZipError("Entry \"" + name + "\" (" + uncompSize + " bytes) exceeds the per-file limit of " + limits.maxEntryBytes());
            }
            totalBytes += uncompSize;
            if (totalBytes > limits.maxTotalBytes()) {
                throw new ZipError("Package exceeds the total size limit of " + limits.maxTotalBytes() + " bytes");
            }

            if (r.u32((int) localOffset) != LOCAL_FILE_HEADER_SIG) {
                throw new ZipError("Corrupt local file header for entry \"" + name + "\"");
            }
            int localNameLen = r.u16((int) localOffset + 26);
            int localExtraLen = r.u16((int) localOffset + 28);
            long dataStart = localOffset + 30 + localNameLen + localExtraLen;
            long dataEnd = dataStart + compSize;
            if (dataEnd > buffer.length) {
                throw new ZipError("Entry \"" + name + "\" data extends beyond the archive");
            }
            byte[] data = java.util.Arrays.copyOfRange(buffer, (int) dataStart, (int) dataEnd);
            if (crc32(data) != crcExpected) {
                throw new ZipError("CRC-32 mismatch for entry \"" + name + "\" — package is corrupt or tampered");
            }
            entries.add(new Entry(name, data));
        }

        return entries;
    }

    private static byte[] concat(List<byte[]> chunks) {
        int total = 0;
        for (byte[] c : chunks) total += c.length;
        byte[] out = new byte[total];
        int pos = 0;
        for (byte[] c : chunks) {
            System.arraycopy(c, 0, out, pos, c.length);
            pos += c.length;
        }
        return out;
    }

    private static final class ByteWriter {
        private final byte[] buf;
        private int pos = 0;

        ByteWriter(int size) {
            buf = new byte[size];
        }

        void u16(int value) {
            buf[pos] = (byte) (value & 0xff);
            buf[pos + 1] = (byte) ((value >>> 8) & 0xff);
            pos += 2;
        }

        void u32(long value) {
            buf[pos] = (byte) (value & 0xff);
            buf[pos + 1] = (byte) ((value >>> 8) & 0xff);
            buf[pos + 2] = (byte) ((value >>> 16) & 0xff);
            buf[pos + 3] = (byte) ((value >>> 24) & 0xff);
            pos += 4;
        }

        byte[] bytes() {
            return buf;
        }
    }

    private static final class ByteReader {
        private final byte[] buf;

        ByteReader(byte[] buf) {
            this.buf = buf;
        }

        int u16(int offset) {
            return (buf[offset] & 0xff) | ((buf[offset + 1] & 0xff) << 8);
        }

        long u32(int offset) {
            return (buf[offset] & 0xffL) | ((buf[offset + 1] & 0xffL) << 8)
                | ((buf[offset + 2] & 0xffL) << 16) | ((buf[offset + 3] & 0xffL) << 24);
        }
    }
}
