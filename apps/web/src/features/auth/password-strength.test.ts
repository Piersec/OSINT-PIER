import { describe, expect, it } from 'vitest';
import {
  analyzePassword,
  generateStrongPassword,
  isStrongPassword,
} from './password-strength';

describe('password strength', () => {
  it('rejects the temporary admin password', () => {
    const analysis = analyzePassword('admin123');

    expect(analysis.strength).toBe('weak');
    expect(isStrongPassword('admin123')).toBe(false);
  });

  it('requires a long password with varied characters', () => {
    expect(analyzePassword('Senha123abc').strength).toBe('fair');
    expect(isStrongPassword('Nuv3!Senha#2026')).toBe(true);
  });

  it('gera sugestões fortes sem depender de uma senha fixa', () => {
    const suggestedPassword = generateStrongPassword();

    expect(suggestedPassword).toHaveLength(18);
    expect(isStrongPassword(suggestedPassword)).toBe(true);
    expect(suggestedPassword).not.toBe('admin123');
  });
});
