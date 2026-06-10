/* ULID generator — sortable, collision-safe ids (docs/02: all records use ULIDs). */

const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

/**
 * Generate a ULID: 10 chars of millisecond timestamp + 16 chars of randomness.
 * @returns {string}
 */
export function ulid() {
  let ts = Date.now();
  let time = '';
  for (let i = 0; i < 10; i++) {
    time = B32[ts % 32] + time;
    ts = Math.floor(ts / 32);
  }
  const rand = new Uint8Array(16);
  crypto.getRandomValues(rand);
  let tail = '';
  for (let i = 0; i < 16; i++) tail += B32[rand[i] % 32];
  return time + tail;
}
