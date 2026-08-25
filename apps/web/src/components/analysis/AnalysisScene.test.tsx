// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AnalysisScene } from './AnalysisScene';

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = () => null;
});

afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  cleanup();
});

describe('AnalysisScene', () => {
  it('expõe o estado da coleta e o alvo para tecnologias assistivas', () => {
    render(<AnalysisScene phase="running" target="example.com" />);

    expect(
      screen.getByRole('region', { name: /Mapeando sinais.*example\.com/i }),
    ).toBeTruthy();
    expect(screen.getByText('coletando sinais')).toBeTruthy();
    expect(screen.getByText('example.com')).toBeTruthy();
  });
});
