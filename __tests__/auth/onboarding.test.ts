import { createVault, _internalAssemble } from '@/auth/onboarding';
import { decodeVaultFile, serializeVaultHeader } from '@/vault/format';
import { aeadDecrypt } from '@/crypto/aead';
import { deriveMasterKey } from '@/crypto/argon2';
import { deriveRecoveryKey } from '@/crypto/recoveryCode';

jest.mock('@/native/keystore', () => ({
  Keystore: {
    generateKeyIfMissing: jest.fn(async () => {}),
    wrap: jest.fn(async (b: Uint8Array) => b),     // identity for the test
    unwrap: jest.fn(async (b: Uint8Array) => b),
    keyExists: jest.fn(async () => true),
    deleteKey: jest.fn(async () => {}),
  },
  VaultStore: {
    read: jest.fn(),
    write: jest.fn(async () => {}),
    exists: jest.fn(async () => false),
    delete: jest.fn(async () => {}),
  },
}));

describe('createVault', () => {
  it('rejects passwords shorter than 8 characters', async () => {
    await expect(
      _internalAssemble({ password: 'short', hint: '' }),
    ).rejects.toThrow('master password must be at least 8 characters');
  });

  it('produces a vault that decrypts with the master password', async () => {
    const { recoveryCode, vaultBytes } = await _internalAssemble({
      password: 'correct horse battery staple',
      hint: 'a hint',
    });
    // 24 base32 chars in 6 groups of 4 separated by dashes = 29 chars total
    expect(recoveryCode).toMatch(/^[A-Z2-7-]{29}$/);

    const decoded = decodeVaultFile(vaultBytes);
    expect(decoded.hint).toBe('a hint');

    const masterKey = await deriveMasterKey('correct horse battery staple', decoded.salt);
    // Vault payload was encrypted with the serialised header as AAD
    const aad = serializeVaultHeader(decoded);
    const plaintext = await aeadDecrypt(
      decoded.vaultCiphertext,
      decoded.vaultTag,
      masterKey,
      decoded.vaultNonce,
      aad,
    );
    const json = JSON.parse(new TextDecoder().decode(plaintext)) as {
      version: number;
      entries: unknown[];
    };
    expect(json.version).toBe(1);
    expect(json.entries).toEqual([]);
  });

  it('produces a recovery wrap that decrypts with the recovery code', async () => {
    const { recoveryCode, masterKey: expectedKey, vaultBytes } = await _internalAssemble({
      password: 'short-pw',  // exactly 8 chars — passes validation
      hint: '',
    });
    const decoded = decodeVaultFile(vaultBytes);
    expect(decoded.recoveryWrappedKey).not.toBeNull();

    // recoveryWrappedKey = nonce(12) || ct(32) || tag(16)
    const rw = decoded.recoveryWrappedKey!;
    const nonce = rw.slice(0, 12);
    const ct = rw.slice(12, 44);
    const tag = rw.slice(44);
    const recoveryKey = await deriveRecoveryKey(recoveryCode, decoded.salt);
    // Recovery wrap uses no AAD — it just wraps the raw key bytes
    const recoveredMasterKey = await aeadDecrypt(ct, tag, recoveryKey, nonce);
    expect(recoveredMasterKey).toEqual(expectedKey);
  });

  it('enforces AAD: vault payload auth fails when header is tampered', async () => {
    const { masterKey, vaultBytes } = await _internalAssemble({
      password: 'valid-pw!',
      hint: 'test hint',
    });
    const decoded = decodeVaultFile(vaultBytes);
    const aad = serializeVaultHeader(decoded);

    // Decrypting with null (empty) AAD must fail — ciphertext was bound to non-empty header
    await expect(
      aeadDecrypt(decoded.vaultCiphertext, decoded.vaultTag, masterKey, decoded.vaultNonce, null),
    ).rejects.toThrow();

    // Decrypting with a bit-flipped AAD must also fail
    const tamperedAad = new Uint8Array(aad);
    tamperedAad[0] = (tamperedAad[0]! ^ 0x01);
    await expect(
      aeadDecrypt(
        decoded.vaultCiphertext,
        decoded.vaultTag,
        masterKey,
        decoded.vaultNonce,
        tamperedAad,
      ),
    ).rejects.toThrow();
  });

  it('createVault writes vault.enc and masterKey.wrapped to VaultStore', async () => {
    const mocked = jest.requireMock('@/native/keystore');
    const VaultStore = mocked.VaultStore as { write: jest.Mock };
    const Keystore = mocked.Keystore as {
      generateKeyIfMissing: jest.Mock;
      wrap: jest.Mock;
    };
    VaultStore.write.mockClear();
    Keystore.generateKeyIfMissing.mockClear();
    Keystore.wrap.mockClear();

    const result = await createVault({ password: 'valid-pw!', hint: 'hint' });
    expect(result.recoveryCode).toBeTruthy();
    expect(result.vault.version).toBe(1);
    expect(VaultStore.write).toHaveBeenCalledWith('vault.enc', expect.any(Uint8Array));
    expect(Keystore.generateKeyIfMissing).toHaveBeenCalled();
    expect(Keystore.wrap).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(VaultStore.write).toHaveBeenCalledWith('masterKey.wrapped', expect.any(Uint8Array));
  });
});
