const compactPattern = /^[A-Z0-9]{12}[0-9]{2}$/;
const formattedPattern =
  /^[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}\/[A-Z0-9]{4}-[0-9]{2}$/;

/** Numeric and alphanumeric CNPJ use the same modulus-11 check digits. */
export function normalizeCnpj(input: string): string | null {
  const value = input.trim().toUpperCase();
  if (!compactPattern.test(value) && !formattedPattern.test(value)) return null;
  const compact = value.replace(/[./-]/g, '');
  if (/^(\d)\1{13}$/.test(compact)) return null;
  for (const length of [12, 13]) {
    let sum = 0;
    for (let index = 0; index < length; index++) {
      const weight = ((length - index - 1) % 8) + 2;
      sum += (compact.charCodeAt(index) - 48) * weight;
    }
    const remainder = sum % 11;
    const digit = remainder < 2 ? 0 : 11 - remainder;
    if (Number(compact[length]) !== digit) return null;
  }
  return compact;
}

export function looksLikeCnpj(input: string): boolean {
  const value = input.trim().toUpperCase();
  return (
    /^\d{14}$/.test(value) ||
    formattedPattern.test(value) ||
    normalizeCnpj(value) !== null
  );
}
