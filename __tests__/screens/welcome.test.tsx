import React from 'react';
import { render } from '@testing-library/react-native';
import Welcome from '../../app/(onboarding)/welcome';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

describe('Welcome', () => {
  it('renders Portuguese title by default', async () => {
    const { findByText } = await render(<Welcome />);
    expect(await findByText('Bem-vindo ao VaultSync')).toBeTruthy();
  });

  it('renders Portuguese subtitle', async () => {
    const { findByText } = await render(<Welcome />);
    expect(
      await findByText(
        'Seu gerenciador de senhas pessoal. Vamos começar criando seu vaultsync.',
      ),
    ).toBeTruthy();
  });

  it('renders CTA button with Portuguese text', async () => {
    const { findByText } = await render(<Welcome />);
    expect(await findByText('Criar vaultsync')).toBeTruthy();
  });
});
