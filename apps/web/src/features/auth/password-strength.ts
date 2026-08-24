export type PasswordStrength = 'weak' | 'fair' | 'strong';

export interface PasswordAnalysis {
  strength: PasswordStrength;
  label: string;
  score: number;
  feedback: string;
}

const commonPasswords = new Set([
  'admin',
  'admin123',
  'password',
  'password123',
  'qwerty',
  'qwerty123',
  '123456',
  '12345678',
  '123456789',
  'senha',
  'senha123',
]);

function hasSequentialCharacters(value: string): boolean {
  const normalized = value.toLowerCase();
  return /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef)/.test(
    normalized,
  );
}

export function analyzePassword(password: string): PasswordAnalysis {
  const normalized = password.toLowerCase();
  const isCommon =
    commonPasswords.has(normalized) || /^admin\d*$/i.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const characterGroups = [
    hasLowercase,
    hasUppercase,
    hasNumber,
    hasSymbol,
  ].filter(Boolean).length;

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 2;
  if (characterGroups >= 2) score += 1;
  if (characterGroups >= 3) score += 2;
  if (new Set(password).size >= 8) score += 1;
  if (hasSequentialCharacters(password)) score -= 1;
  if (isCommon) score = 0;

  if (isCommon || password.length < 8 || score < 2) {
    return {
      strength: 'weak',
      label: 'Fraca',
      score,
      feedback:
        'Use pelo menos 12 caracteres, misture maiúsculas, minúsculas, números e símbolos.',
    };
  }

  if (password.length < 12 || characterGroups < 3 || score < 5) {
    return {
      strength: 'fair',
      label: 'Razoável',
      score,
      feedback:
        'Ainda previsível. Aumente o tamanho e misture mais tipos de caracteres.',
    };
  }

  return {
    strength: 'strong',
    label: 'Forte',
    score,
    feedback: 'Senha forte o suficiente para proteger sua conta.',
  };
}

export function isStrongPassword(password: string): boolean {
  return analyzePassword(password).strength === 'strong';
}

const passwordCharacterSets = [
  'abcdefghijkmnopqrstuvwxyz',
  'ABCDEFGHJKLMNPQRSTUVWXYZ',
  '23456789',
  '!@#$%^&*_-+=?',
];
const passwordAlphabet = passwordCharacterSets.join('');

function randomIndex(max: number): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0]! % max;
}

export function generateStrongPassword(length = 18): string {
  const targetLength = Math.max(12, length);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const characters = passwordCharacterSets.map(
      (characterSet) => characterSet[randomIndex(characterSet.length)]!,
    );

    while (characters.length < targetLength) {
      characters.push(passwordAlphabet[randomIndex(passwordAlphabet.length)]!);
    }

    for (let index = characters.length - 1; index > 0; index -= 1) {
      const swapIndex = randomIndex(index + 1);
      [characters[index], characters[swapIndex]] = [
        characters[swapIndex]!,
        characters[index]!,
      ];
    }

    const password = characters.join('');
    if (isStrongPassword(password)) return password;
  }

  throw new Error('Não foi possível gerar uma senha forte.');
}
