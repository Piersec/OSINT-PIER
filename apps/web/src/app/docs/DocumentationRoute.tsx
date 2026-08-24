'use client';

import { useQuery } from '@tanstack/react-query';
import { listChecks } from '../../api/client';
import { AuthGate } from '../../features/auth/AuthGate';
import { DocumentationPage } from '../../features/documentation/DocumentationPage';

function DocumentationContent() {
  const checksQuery = useQuery({ queryKey: ['checks'], queryFn: listChecks });

  return <DocumentationPage checks={checksQuery.data ?? []} />;
}

export function DocumentationRoute() {
  return (
    <AuthGate>
      <DocumentationContent />
    </AuthGate>
  );
}
