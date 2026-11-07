import { describe, expect, it } from 'vitest';
import { formatUzPhone } from '../phone';

describe('formatUzPhone', () => {
  it('groups an Uzbek phone number for display', () => {
    expect(formatUzPhone('+998901234567')).toBe('+998 90 123 45 67');
  });
});
