'use client';

import { App } from '../App';
import { AuthGate } from '../features/auth/AuthGate';

export default function Page() {
  return (
    <AuthGate>
      <App />
    </AuthGate>
  );
}
