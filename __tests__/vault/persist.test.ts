// Mock sync dependencies so the fire-and-forget in enqueueSync() does not
// touch real native modules (SQLite, Drive, Network) during persist tests.
jest.mock('@/sync/queue', () => ({ enqueuePush: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/sync/orchestrator', () => ({ syncOnce: jest.fn().mockResolvedValue(undefined) }));

import { persistVault } from '@/vault/persist';
import { _internalAssemble } from '@/auth/onboarding';
import { addLogin } from '@/vault/mutations';
import { aeadDecrypt } from '@/crypto/aead';
import { decodeVaultFile, serializeVaultHeader } from '@/vault/format';
import { useSyncStore } from '@/sync/store';
import { enqueuePush } from '@/sync/queue';
import { syncOnce } from '@/sync/orchestrator';
import type { Login, VaultV1 } from '@/vault/types';

const mockMemoryStore = new Map<string, Uint8Array>();

jest.mock('@/native/keystore', () => ({
  Keystore: {
    generateKeyIfMissing: jest.fn(async () => {}),
    wrap: jest.fn(async (b: Uint8Array) => b),
    unwrap: jest.fn(async (b: Uint8Array) => b),
    keyExists: jest.fn(async () => true),
    deleteKey: jest.fn(async () => {}),
  },
  VaultStore: {
    read: jest.fn(async (n: string) => {
      const v = mockMemoryStore.get(n);
      if (!v) throw new Error('FileNotFound');
      return v;
    }),
    write: jest.fn(async (n: string, b: Uint8Array) => { mockMemoryStore.set(n, b); }),
    exists: jest.fn(async (n: string) => mockMemoryStore.has(n)),
    delete: jest.fn(async (n: string) => { mockMemoryStore.delete(n); }),
  },
}));

beforeEach(() => {
  mockMemoryStore.clear();
  // Reset sync store so status-assertions start from a clean slate.
  useSyncStore.setState(
    { status: 'idle', lastSyncedAt: null, queueDepth: 0 } as Parameters<typeof useSyncStore.setState>[0],
  );
});

/** Seed a real on-disk vault.enc and return its masterKey + decoded vault object. */
async function seedVault(hint = 'h'): Promise<{ masterKey: Uint8Array; vault: VaultV1 }> {
  const { masterKey, vault, vaultBytes } = await _internalAssemble({ password: 'pw1234567', hint });
  mockMemoryStore.set('vault.enc', vaultBytes);
  mockMemoryStore.set('masterKey.wrapped', masterKey);
  return { masterKey, vault };
}

describe('persistVault', () => {
  it('encrypts + writes a mutated vault that round-trips under the new header AAD', async () => {
    const { masterKey, vault } = await seedVault();
    const before = decodeVaultFile(mockMemoryStore.get('vault.enc')!);

    const updated = addLogin(vault, { title: 'GitHub', username: 'me', password: 'pw' });
    await persistVault(updated, masterKey);

    const after = decodeVaultFile(mockMemoryStore.get('vault.enc')!);

    // New payload nonce was generated.
    expect(Buffer.from(after.vaultNonce)).not.toEqual(Buffer.from(before.vaultNonce));
    // Header secrets preserved (no rotation).
    expect(Buffer.from(after.salt)).toEqual(Buffer.from(before.salt));
    expect(Buffer.from(after.recoveryWrappedKey!)).toEqual(Buffer.from(before.recoveryWrappedKey!));
    expect(after.hint).toBe(before.hint);

    // Decrypt with the AAD derived from the NEW header — proves write↔read AAD symmetry.
    const aad = serializeVaultHeader(after);
    const plaintext = await aeadDecrypt(after.vaultCiphertext, after.vaultTag, masterKey, after.vaultNonce, aad);
    const roundTripped = JSON.parse(new TextDecoder().decode(plaintext)) as VaultV1;

    expect(roundTripped.entries).toHaveLength(1);
    expect((roundTripped.entries[0] as Login).title).toBe('GitHub');
  });

  it('preserves masterKey.wrapped (no Keystore rotation)', async () => {
    const { masterKey, vault } = await seedVault();
    const wrappedBefore = mockMemoryStore.get('masterKey.wrapped')!;

    await persistVault(addLogin(vault, { title: 'x', username: '', password: '' }), masterKey);

    expect(mockMemoryStore.get('masterKey.wrapped')).toBe(wrappedBefore);
  });

  it('when enqueuePush rejects: surfaces error via sync store and still calls syncOnce', async () => {
    const { masterKey, vault } = await seedVault();
    jest.mocked(enqueuePush).mockRejectedValueOnce(new Error('SQLite: disk full'));

    await persistVault(vault, masterKey);

    // Drain the microtask queue so the fire-and-forget IIFE settles.
    await Promise.resolve();
    await Promise.resolve();

    const state = useSyncStore.getState();
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.message).toBe('SQLite: disk full');
    }
    expect(jest.mocked(syncOnce)).toHaveBeenCalled();
  });

  it('throws when decrypting under a tampered/mismatched AAD (header is bound)', async () => {
    const { masterKey, vault } = await seedVault();
    await persistVault(addLogin(vault, { title: 'x', username: '', password: '' }), masterKey);

    const after = decodeVaultFile(mockMemoryStore.get('vault.enc')!);
    const tamperedAad = serializeVaultHeader(after);
    const lastIdx = tamperedAad.length - 1;
    tamperedAad[lastIdx] = (tamperedAad[lastIdx]! ^ 0xff) & 0xff; // flip a header byte

    await expect(
      aeadDecrypt(after.vaultCiphertext, after.vaultTag, masterKey, after.vaultNonce, tamperedAad),
    ).rejects.toThrow();

    // Also: decrypting with no AAD at all must fail.
    await expect(
      aeadDecrypt(after.vaultCiphertext, after.vaultTag, masterKey, after.vaultNonce, null),
    ).rejects.toThrow();
  });
});
