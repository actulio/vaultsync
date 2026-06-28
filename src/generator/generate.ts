import { randomBytes } from '@/crypto/aead';

export type GeneratorOptions = {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
};

const AMBIG = new Set('0Oo1lI');
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const SYMBOLS = '!@#$%^&*()-_=+[]{};:,.<>/?';

function alphabet(opts: GeneratorOptions): { classes: string[]; combined: string } {
  const classes: string[] = [];
  if (opts.lower) classes.push(opts.avoidAmbiguous ? stripAmbig(LOWER) : LOWER);
  if (opts.upper) classes.push(opts.avoidAmbiguous ? stripAmbig(UPPER) : UPPER);
  if (opts.digits) classes.push(opts.avoidAmbiguous ? stripAmbig(DIGITS) : DIGITS);
  if (opts.symbols) classes.push(SYMBOLS);
  if (classes.length === 0) throw new Error('at least one character class required');
  return { classes, combined: classes.join('') };
}

function stripAmbig(s: string): string {
  return [...s].filter((c) => !AMBIG.has(c)).join('');
}

async function unbiasedIndex(max: number): Promise<number> {
  const limit = 256 - (256 % max);
  for (;;) {
    const bytes = await randomBytes(1);
    const b = bytes[0];
    if (b !== undefined && b < limit) return b % max;
  }
}

export async function generatePassword(opts: GeneratorOptions): Promise<string> {
  if (opts.length < 4) throw new Error('length must be ≥ 4');
  const { classes, combined } = alphabet(opts);

  const result: string[] = [];
  // Seed with one char from each class to guarantee coverage.
  for (const cls of classes) {
    const ch = cls[await unbiasedIndex(cls.length)];
    if (ch !== undefined) result.push(ch);
  }
  while (result.length < opts.length) {
    const ch = combined[await unbiasedIndex(combined.length)];
    if (ch !== undefined) result.push(ch);
  }
  // Fisher–Yates shuffle so seeded chars are not at fixed positions.
  for (let i = result.length - 1; i > 0; i--) {
    const j = await unbiasedIndex(i + 1);
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result.join('');
}
