'use strict';

/**
 * Minimal, dependency-free, deterministic ZIP container reader/writer.
 *
 * No zip library ships with this repo and the package registry is unavailable in some
 * environments this backend must build in, so `.lspkg` uses a hand-rolled ZIP implementation on
 * top of Node's built-in `zlib`/`crypto` only. Entries are stored uncompressed (method 0 / STORE):
 * package contents are JSON text in the kilobytes-to-low-megabytes range, and STORE removes any
 * question of cross-environment compression determinism in exchange for a larger file — an
 * acceptable trade for a deployment artifact that must build byte-for-byte identically from
 * identical input (see `builder.js`).
 *
 * All entry timestamps are pinned to a fixed DOS date (1980-01-01) so two builds from identical
 * logical content never differ because of wall-clock time — determinism is a hard requirement
 * (LC-ARCH-002 §3, §12: "A validated project builds a deterministic .lspkg").
 */

const LOCAL_FILE_HEADER_SIG = 0x04034b50;
const CENTRAL_DIR_HEADER_SIG = 0x02014b50;
const END_OF_CENTRAL_DIR_SIG = 0x06054b50;
const FIXED_DOS_DATE = 0x21; // 1980-01-01
const FIXED_DOS_TIME = 0x00;

// Standard reflected CRC-32 (polynomial 0xEDB88320), table-built once.
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

/** @param {Buffer} buf */
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * @param {Array<{ name: string, data: Buffer }>} entries - names must be path-safe, forward-slash,
 *   relative, already validated by the caller (builder.js constructs these internally).
 * @returns {Buffer}
 */
function buildZip(entries) {
  // Deterministic entry order: caller controls array order; we do not re-sort here so builder.js's
  // explicit canonical ordering (manifest.json first, then sorted content files) is preserved.
  const localChunks = [];
  const centralChunks = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.data;
    const crc = crc32(data);
    const size = data.length;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(LOCAL_FILE_HEADER_SIG, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: STORE
    local.writeUInt16LE(FIXED_DOS_TIME, 10);
    local.writeUInt16LE(FIXED_DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18); // compressed size == uncompressed for STORE
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra field length
    localChunks.push(local, nameBuf, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(CENTRAL_DIR_HEADER_SIG, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(FIXED_DOS_TIME, 12);
    central.writeUInt16LE(FIXED_DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(size, 20);
    central.writeUInt32LE(size, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // relative offset of local header
    centralChunks.push(central, nameBuf);

    offset += local.length + nameBuf.length + data.length;
  }

  const centralDirStart = offset;
  const centralDir = Buffer.concat(centralChunks);
  const centralDirSize = centralDir.length;

  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIR_SIG, 0);
  end.writeUInt16LE(0, 4); // disk number
  end.writeUInt16LE(0, 6); // disk with central dir
  end.writeUInt16LE(entries.length, 8); // entries this disk
  end.writeUInt16LE(entries.length, 10); // entries total
  end.writeUInt32LE(centralDirSize, 12);
  end.writeUInt32LE(centralDirStart, 16);
  end.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localChunks, centralDir, end]);
}

class ZipError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ZipError';
  }
}

/**
 * Rejects zip-slip / path traversal / absolute paths — an entry name is only safe if it is a
 * relative, forward-slash path with no `..` segment and no drive letter.
 * @param {string} name
 */
function isPathSafe(name) {
  if (typeof name !== 'string' || !name.length) return false;
  if (name.includes('\\')) return false;
  if (name.startsWith('/') || /^[a-zA-Z]:/.test(name)) return false;
  const segments = name.split('/');
  return segments.every((seg) => seg !== '' && seg !== '.' && seg !== '..');
}

/**
 * @param {Buffer} buffer
 * @param {{ maxFiles?: number, maxTotalBytes?: number, maxEntryBytes?: number }} [limits]
 * @returns {Array<{ name: string, data: Buffer }>}
 */
function readZip(buffer, limits = {}) {
  const { maxFiles = 500, maxTotalBytes = 200 * 1024 * 1024, maxEntryBytes = 64 * 1024 * 1024 } = limits;

  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new ZipError('Not a valid ZIP archive (too small)');
  }

  // Locate End Of Central Directory by scanning backward for its signature (no ZIP comment is
  // ever written by buildZip, so it is always the last 22 bytes of a package we produced, but we
  // scan defensively for any well-formed archive).
  let eocdOffset = -1;
  const maxBack = Math.min(buffer.length, 22 + 65536);
  for (let i = buffer.length - 22; i >= buffer.length - maxBack; i -= 1) {
    if (i < 0) break;
    if (buffer.readUInt32LE(i) === END_OF_CENTRAL_DIR_SIG) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new ZipError('End of central directory record not found');

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirSize = buffer.readUInt32LE(eocdOffset + 12);
  const centralDirOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > maxFiles) {
    throw new ZipError(`Package contains ${totalEntries} files, exceeding the limit of ${maxFiles}`);
  }
  if (centralDirOffset + centralDirSize > eocdOffset) {
    throw new ZipError('Corrupt central directory (out of bounds)');
  }

  const entries = [];
  let totalBytes = 0;
  let pos = centralDirOffset;
  for (let i = 0; i < totalEntries; i += 1) {
    if (buffer.readUInt32LE(pos) !== CENTRAL_DIR_HEADER_SIG) {
      throw new ZipError('Corrupt central directory entry');
    }
    const method = buffer.readUInt16LE(pos + 10);
    const crcExpected = buffer.readUInt32LE(pos + 16);
    const compSize = buffer.readUInt32LE(pos + 20);
    const uncompSize = buffer.readUInt32LE(pos + 24);
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    const localOffset = buffer.readUInt32LE(pos + 42);
    const name = buffer.slice(pos + 46, pos + 46 + nameLen).toString('utf8');
    pos += 46 + nameLen + extraLen + commentLen;

    if (method !== 0) {
      throw new ZipError(`Unsupported compression method (${method}) for entry "${name}" — only STORE is accepted`);
    }
    if (!isPathSafe(name)) {
      throw new ZipError(`Unsafe or path-traversal entry name rejected: "${name}"`);
    }
    if (uncompSize > maxEntryBytes) {
      throw new ZipError(`Entry "${name}" (${uncompSize} bytes) exceeds the per-file limit of ${maxEntryBytes}`);
    }
    totalBytes += uncompSize;
    if (totalBytes > maxTotalBytes) {
      throw new ZipError(`Package exceeds the total size limit of ${maxTotalBytes} bytes`);
    }

    if (buffer.readUInt32LE(localOffset) !== LOCAL_FILE_HEADER_SIG) {
      throw new ZipError(`Corrupt local file header for entry "${name}"`);
    }
    const localNameLen = buffer.readUInt16LE(localOffset + 26);
    const localExtraLen = buffer.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const dataEnd = dataStart + compSize;
    if (dataEnd > buffer.length) {
      throw new ZipError(`Entry "${name}" data extends beyond the archive`);
    }
    const data = buffer.slice(dataStart, dataEnd);
    if (crc32(data) !== crcExpected) {
      throw new ZipError(`CRC-32 mismatch for entry "${name}" — package is corrupt or tampered`);
    }
    entries.push({ name, data });
  }

  return entries;
}

module.exports = { buildZip, readZip, crc32, isPathSafe, ZipError };
