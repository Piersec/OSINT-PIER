import { describe, expect, it } from 'vitest';
import { readTextLimited } from './http.js';
import { isPublicAddress } from './ip.js';

describe('utilitários de rede', () => {
  it('trunca corpos grandes sem falhar nem manter o download aberto', async () => {
    const result = await readTextLimited(new Response('1234567890extra'), 10);
    expect(result).toBe('1234567890');
  });

  it('diferencia faixas IPv4 privadas, documentais e públicas', () => {
    expect(isPublicAddress('192.168.1.1')).toBe(false);
    expect(isPublicAddress('198.51.100.2')).toBe(false);
    expect(isPublicAddress('203.0.113.7')).toBe(false);
    expect(isPublicAddress('192.0.42.1')).toBe(true);
    expect(isPublicAddress('8.8.8.8')).toBe(true);
  });
});
