import { generatePassword, type GeneratorOptions } from '@/generator/generate';

const base: GeneratorOptions = { length: 20, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false };

describe('generator', () => {
  it('produces a password of requested length', async () => {
    expect((await generatePassword(base)).length).toBe(20);
  });

  it('honours the digits-only configuration', async () => {
    const pw = await generatePassword({ ...base, lower: false, upper: false, digits: true, symbols: false });
    expect(pw).toMatch(/^[0-9]+$/);
  });

  it('refuses if no character class is selected', async () => {
    await expect(generatePassword({ ...base, lower: false, upper: false, digits: false, symbols: false }))
      .rejects.toThrow(/character class/i);
  });

  it('includes at least one char from each selected class', async () => {
    const pw = await generatePassword({ ...base, length: 8 });
    expect(/[a-z]/.test(pw)).toBe(true);
    expect(/[A-Z]/.test(pw)).toBe(true);
    expect(/[0-9]/.test(pw)).toBe(true);
    expect(/[^a-zA-Z0-9]/.test(pw)).toBe(true);
  });

  it('avoids ambiguous characters when requested', async () => {
    const pw = await generatePassword({ ...base, avoidAmbiguous: true, length: 200 });
    expect(/[0Oo1lI]/.test(pw)).toBe(false);
  });

  it('two generations differ', async () => {
    expect(await generatePassword(base)).not.toBe(await generatePassword(base));
  });
});
