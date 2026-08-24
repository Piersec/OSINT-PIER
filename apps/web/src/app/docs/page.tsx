import type { Metadata } from 'next';
import { DocumentationRoute } from './DocumentationRoute';

export const metadata: Metadata = {
  title: 'Documentação · OSINT Pier',
  description: 'Manual interno para usar o OSINT Pier com segurança.',
};

export default function DocumentationPageRoute() {
  return <DocumentationRoute />;
}
