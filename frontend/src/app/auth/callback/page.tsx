'use client';

import { useAuth } from 'react-oidc-context';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AuthCallbackPage() {
  const auth = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading) {
      if (auth.error) {
        console.error('Authentication error:', auth.error);
        router.push('/auth?error=' + encodeURIComponent(auth.error.message));
      } else if (auth.user) {
        console.log('Authentication successful, redirecting to home');
        router.push('/');
      } else {
        console.log('No user found after callback, redirecting to auth');
        router.push('/auth');
      }
    }
  }, [auth.isLoading, auth.error, auth.user, router]);

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Processing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p>Redirecting...</p>
      </div>
    </div>
  );
} 