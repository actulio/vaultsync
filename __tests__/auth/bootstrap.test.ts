import { bootstrapAuth } from '@/auth/bootstrap';
import { useAuthStore } from '@/auth/store';
import { vaultExists } from '@/auth/unlock';

jest.mock('@/auth/unlock', () => ({ vaultExists: jest.fn() }));
const mockVaultExists = vaultExists as jest.MockedFunction<typeof vaultExists>;

describe('bootstrapAuth', () => {
  beforeEach(() => useAuthStore.getState().reset());

  it('sets no_vault when no vault on disk', async () => {
    mockVaultExists.mockResolvedValue(false);
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('no_vault');
  });

  it('sets locked when a vault exists', async () => {
    mockVaultExists.mockResolvedValue(true);
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('locked');
  });
});
