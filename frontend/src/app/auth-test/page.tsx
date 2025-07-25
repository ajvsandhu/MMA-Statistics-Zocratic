'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default function AuthTestPage() {
  const { 
    isAuthenticated, 
    isLoading, 
    userProfile, 
    error, 
    signOut,
    getAccessToken,
    getIdToken
  } = useAuth();

  const accessToken = getAccessToken();
  const idToken = getIdToken();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold">Loading Authentication...</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">Authentication Test Page</h1>
        <p className="text-gray-600">Test Cognito OIDC authentication flow</p>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-800">Authentication Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-700">{error.message}</p>
            <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
              {JSON.stringify(error, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {!isAuthenticated ? (
        /* Unauthenticated State */
        <Card>
          <CardHeader>
            <CardTitle>Not Authenticated</CardTitle>
            <CardDescription>
              Choose an option to test the authentication flow
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <Button asChild className="flex-1" variant="default">
                <Link href="/auth">Sign In</Link>
              </Button>
              <Button asChild className="flex-1" variant="outline">
                <Link href="/auth">Sign Up</Link>
              </Button>
            </div>
            <div className="text-sm text-gray-600">
              <p><strong>Sign In:</strong> Goes to auth page in sign-in mode</p>
              <p><strong>Sign Up:</strong> Goes to auth page in sign-up mode</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Authenticated State */
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-green-700">✅ Authenticated Successfully</CardTitle>
              <CardDescription>
                You are currently signed in
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={signOut}
                variant="destructive"
                className="w-full sm:w-auto"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* User Profile Information */}
          <Card>
            <CardHeader>
              <CardTitle>User Profile</CardTitle>
              <CardDescription>Information from your user profile</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">User ID:</label>
                  <p className="text-sm font-mono bg-gray-100 p-2 rounded mt-1">
                    {userProfile.id || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email:</label>
                  <p className="text-sm bg-gray-100 p-2 rounded mt-1">
                    {userProfile.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Username:</label>
                  <p className="text-sm bg-gray-100 p-2 rounded mt-1">
                    {userProfile.preferred_username || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nickname:</label>
                  <p className="text-sm bg-gray-100 p-2 rounded mt-1">
                    {userProfile.nickname || 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Token Information */}
          <Card>
            <CardHeader>
              <CardTitle>Token Information</CardTitle>
              <CardDescription>
                Access and ID tokens (showing first 50 characters)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Access Token:</label>
                <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                  {accessToken ? `${accessToken.substring(0, 50)}...` : 'N/A'}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">ID Token:</label>
                <p className="text-xs font-mono bg-gray-100 p-2 rounded mt-1 break-all">
                  {idToken ? `${idToken.substring(0, 50)}...` : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Full Profile Data */}
          <Card>
            <CardHeader>
              <CardTitle>Full Profile Data</CardTitle>
              <CardDescription>
                Complete user profile object from Cognito
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-96">
                {JSON.stringify(userProfile.fullProfile, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
} 