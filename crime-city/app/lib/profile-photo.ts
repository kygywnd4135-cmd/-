// Uploads are re-encoded by the browser as square JPEGs. Validate the bytes again on the server.
export function decodeProfilePhoto(data: unknown): {base64: string; bytes: Uint8Array} | null {
  if (typeof data !== 'string' || data.length > 420000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(data)) return null;
  const base64 = data.slice('data:image/jpeg;base64,'.length);
  let binary: string;
  try {binary = atob(base64);} catch {return null;}
  if (binary.length < 100 || binary.length > 300000) return null;
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) return null;
  let square = false, scan = false, offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) return null;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    if (marker === 218) {scan = true; break;}
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length) return null;
    if ([192, 193, 194].includes(marker)) {
      if (length < 8) return null;
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (width !== 512 || height !== 512) return null;
      square = true;
    }
    offset += length;
  }
  return square && scan ? {base64, bytes} : null;
}
