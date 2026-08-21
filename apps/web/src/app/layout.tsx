import type { Metadata } from 'next';
import '../styles.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'OSINT Pier',
  description: 'Plataforma interna de análise OSINT e superfície de ataque.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
