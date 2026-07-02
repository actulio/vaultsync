import sodium from 'react-native-libsodium';

let ready: Promise<void> | null = null;
const ensureReady = (): Promise<void> => (ready ??= sodium.ready);

export type Argon2Params = {
  memoryKiB: number;
  timeCost: number;
  parallelism: number;
  hashLen: number;
};

export const DEFAULT_ARGON2: Argon2Params = {
  memoryKiB: 65536, // 64 MiB
  timeCost: 3,
  parallelism: 1,
  hashLen: 32,
};

export async function deriveMasterKey(
  password: string,
  salt: Uint8Array,
  params: Argon2Params = DEFAULT_ARGON2,
): Promise<Uint8Array> {
  await ensureReady();
  if (salt.length !== 16) throw new Error('salt must be 16 bytes');
  if (params.parallelism !== 1) {
    throw new Error('libsodium pwhash only supports parallelism = 1');
  }
  const normalized = password.normalize('NFKC');
  return sodium.crypto_pwhash(
    params.hashLen,
    normalized,
    salt,
    params.timeCost,
    params.memoryKiB * 1024,
    sodium.crypto_pwhash_ALG_ARGON2ID13,
  );
}
