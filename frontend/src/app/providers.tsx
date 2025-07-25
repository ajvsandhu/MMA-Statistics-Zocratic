'use client';

import { ReactNode } from 'react';
import { AuthProvider } from 'react-oidc-context';
import { cognitoConfig } from '@/lib/cognito-config';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <AuthProvider {...cognitoConfig}>
      {children}
    </AuthProvider>
  );
} 