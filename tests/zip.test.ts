import { describe, expect, it } from 'vitest';
import { crc32, makeZip } from '../src/client/lib/zip';

describe('export zip de la photothèque', () => {
  it('CRC-32 de référence', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
    expect(crc32(new Uint8Array())).toBe(0);
  });

  it('archive lisible : en-têtes, répertoire central et fin d’archive cohérents', async () => {
    const enc = new TextEncoder();
    const files = [
      { name: 'iconiques/é.webp', data: enc.encode('photo 1') },
      { name: 'photos.json', data: enc.encode('[]') },
    ];
    const bytes = new Uint8Array(await makeZip(files).arrayBuffer());
    const view = new DataView(bytes.buffer);

    // Fin d'archive (22 derniers octets)
    const end = bytes.length - 22;
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const cdSize = view.getUint32(end + 12, true);
    const cdOffset = view.getUint32(end + 16, true);
    expect(cdOffset + cdSize).toBe(end);

    // Chaque entrée du répertoire central pointe vers un en-tête local valide et le bon contenu
    let p = cdOffset;
    for (const f of files) {
      expect(view.getUint32(p, true)).toBe(0x02014b50);
      const nameLen = view.getUint16(p + 28, true);
      const localOffset = view.getUint32(p + 42, true);
      const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
      expect(name).toBe(f.name);
      expect(view.getUint32(localOffset, true)).toBe(0x04034b50);
      expect(view.getUint32(localOffset + 14, true)).toBe(crc32(f.data));
      const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true);
      expect(bytes.subarray(dataStart, dataStart + f.data.length)).toEqual(f.data);
      p += 46 + nameLen;
    }
  });
});
