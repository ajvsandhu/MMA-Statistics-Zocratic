"use client";

import { useAuth } from '@/hooks/use-auth';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeSwitcher } from '@/components/theme-switcher';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  const { isAuthenticated, isLoading, userProfile, getAccessToken, getIdToken } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<any>(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/auth');
      return;
    }
    if (isAuthenticated && userProfile.id) {
      fetchSettings();
    }
    // eslint-disable-next-line
  }, [isAuthenticated, isLoading, userProfile?.id]);

  async function fetchSettings() {
    setLoadingSettings(true);
    setError(null);
    try {
      const token = getAccessToken() || getIdToken();
      
      if (!token) {
        throw new Error('No valid authentication token found');
      }
      
      const res = await fetch(`/api/user-settings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch settings');
      }
      
      setSettings(data.settings || {});
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingSettings(false);
    }
  }

  async function saveSettings(newSettings: any) {
    setSaving(true);
    setError(null);
    try {
      const token = getAccessToken() || getIdToken();
      
      if (!token) {
        throw new Error('No valid authentication token found');
      }
      
      const res = await fetch(`/api/user-settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: newSettings }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }
      
      setSettings(newSettings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading || loadingSettings) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700">You need to be signed in to access settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account preferences and theme
        </p>
      </div>

      {/* User Info */}
      <Card>
        <CardHeader>
          <CardTitle>Account Information</CardTitle>
          <CardDescription>Your current account details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4 sm:space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <span className="font-medium">Email:</span>
                <p className="text-muted-foreground break-words">{userProfile.email || 'Not available'}</p>
              </div>
              <div className="space-y-1">
                <span className="font-medium">Username:</span>
                                 <p className="text-muted-foreground break-words">{userProfile.preferred_username || userProfile.email?.split('@')[0] || 'Not available'}</p>
              </div>
            </div>
            <div className="space-y-1">
              <span className="font-medium">User ID:</span>
              <p className="text-muted-foreground font-mono text-xs break-all">{userProfile.id || 'Not available'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Zocratic MMA looks</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSwitcher />
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Manage your notification preferences</CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <p className="text-red-700">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchSettings}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}
          
          <div className="space-y-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={!!settings?.notifications}
                onChange={e => saveSettings({ ...settings, notifications: e.target.checked })}
                disabled={saving}
                className="rounded border-input"
              />
              <div>
                <span className="font-medium">Email Notifications</span>
                <p className="text-sm text-muted-foreground">Receive updates about fight predictions and results</p>
              </div>
            </label>
            
            {saving && (
              <p className="text-sm text-muted-foreground">Saving...</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 