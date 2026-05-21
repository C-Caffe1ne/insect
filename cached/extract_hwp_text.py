#!/usr/bin/env python3
import struct
import sys
import zlib


FREESECT = 0xFFFFFFFF
ENDOFCHAIN = 0xFFFFFFFE
FATSECT = 0xFFFFFFFD
DIFSECT = 0xFFFFFFFC


def u16(data, offset):
    return struct.unpack_from("<H", data, offset)[0]


def u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


class CompoundFile:
    def __init__(self, data):
        self.data = data
        if data[:8] != bytes.fromhex("D0CF11E0A1B11AE1"):
            raise ValueError("not an OLE compound file")
        self.sector_size = 1 << u16(data, 30)
        self.mini_sector_size = 1 << u16(data, 32)
        self.first_dir_sector = u32(data, 48)
        self.first_minifat_sector = u32(data, 60)
        self.minifat_sector_count = u32(data, 64)
        self.first_difat_sector = u32(data, 68)
        self.difat_sector_count = u32(data, 72)
        self.difat = [u32(data, 76 + i * 4) for i in range(109)]
        self.difat = [sid for sid in self.difat if sid not in (FREESECT, ENDOFCHAIN)]
        self.fat = self._load_fat()
        self.entries = self._load_directory()
        self.root = next(entry for entry in self.entries if entry["type"] == 5)
        self.minifat = self._load_minifat()
        self.ministream = self._read_regular_stream(self.root["start"], self.root["size"])

    def _sector(self, sid):
        start = 512 + sid * self.sector_size
        return self.data[start:start + self.sector_size]

    def _chain(self, start, table=None):
        if start in (FREESECT, ENDOFCHAIN):
            return []
        table = table or self.fat
        out = []
        seen = set()
        sid = start
        while sid not in (FREESECT, ENDOFCHAIN) and sid not in seen:
            seen.add(sid)
            out.append(sid)
            if sid >= len(table):
                break
            sid = table[sid]
        return out

    def _load_fat(self):
        sectors = []
        for sid in self.difat:
            if sid not in (FATSECT, DIFSECT, FREESECT, ENDOFCHAIN):
                sectors.append(self._sector(sid))
        fat = []
        for sector in sectors:
            fat.extend(u32(sector, i) for i in range(0, len(sector), 4))
        return fat

    def _read_regular_stream(self, start, size):
        chunks = [self._sector(sid) for sid in self._chain(start)]
        return b"".join(chunks)[:size]

    def _load_directory(self):
        raw = self._read_regular_stream(self.first_dir_sector, 1 << 30)
        entries = []
        for offset in range(0, len(raw), 128):
            entry = raw[offset:offset + 128]
            if len(entry) < 128:
                continue
            name_len = u16(entry, 64)
            name = entry[:max(0, name_len - 2)].decode("utf-16le", "ignore")
            entry_type = entry[66]
            if not name:
                continue
            entries.append({
                "name": name,
                "type": entry_type,
                "start": u32(entry, 116),
                "size": struct.unpack_from("<Q", entry, 120)[0],
            })
        return entries

    def _load_minifat(self):
        if self.first_minifat_sector in (FREESECT, ENDOFCHAIN):
            return []
        raw = b"".join(self._sector(sid) for sid in self._chain(self.first_minifat_sector))
        return [u32(raw, i) for i in range(0, len(raw), 4)]

    def read_stream(self, name):
        entry = next((item for item in self.entries if item["name"] == name), None)
        if not entry:
            raise KeyError(name)
        if entry["size"] < 4096 and self.minifat:
            chunks = []
            for sid in self._chain(entry["start"], self.minifat):
                start = sid * self.mini_sector_size
                chunks.append(self.ministream[start:start + self.mini_sector_size])
            return b"".join(chunks)[:entry["size"]]
        return self._read_regular_stream(entry["start"], entry["size"])


def records(data):
    offset = 0
    while offset + 4 <= len(data):
        header = u32(data, offset)
        offset += 4
        tag = header & 0x3FF
        size = (header >> 20) & 0xFFF
        if size == 0xFFF:
            if offset + 4 > len(data):
                break
            size = u32(data, offset)
            offset += 4
        payload = data[offset:offset + size]
        offset += size
        yield tag, payload


def extract_text(path):
    cfb = CompoundFile(open(path, "rb").read())
    header = cfb.read_stream("FileHeader")
    compressed = bool(header[36] & 1) if len(header) > 36 else True
    parts = []
    for entry in cfb.entries:
        if not entry["name"].startswith("Section"):
            continue
        raw = cfb.read_stream(entry["name"])
        if compressed:
            raw = zlib.decompress(raw, -15)
        for tag, payload in records(raw):
            if tag == 67:
                text = payload.decode("utf-16le", "ignore")
                text = text.replace("\r", "\n")
                if text.strip():
                    parts.append(text)
    return "\n".join(parts)


if __name__ == "__main__":
    print(extract_text(sys.argv[1]))
