'use client';

import { useAuth as useOidcAuth } from 'react-oidc-context';
import { AUTHORITY, CLIENT_ID, REDIRECT_URI, LOGOUT_REDIRECT, SCOPE } from '@/lib/cognito-config';
import { 
  CognitoUserPool, 
  CognitoUser, 
  AuthenticationDetails,
  CognitoUserAttribute 
} from 'amazon-cognito-identity-js';
import { useState, useEffect } from 'react';
import { ENDPOINTS } from '@/lib/api-config';

export interface UserProfile {
  id?: string;
  email?: string;
  preferred_username?: string;
  given_name?: string;
  nickname?: string;
  fullProfile?: any;
}

export interface SignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

// Extract region and user pool ID from the environment - SECURITY: No hardcoded values
const REGION = process.env.NEXT_PUBLIC_COGNITO_REGION;
const USER_POOL_ID = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;

// Validate required environment variables
if (!REGION) {
  throw new Error('NEXT_PUBLIC_COGNITO_REGION environment variable is required');
}
if (!USER_POOL_ID) {
  throw new Error('NEXT_PUBLIC_COGNITO_USER_POOL_ID environment variable is required');
}

// Initialize Cognito User Pool
const poolData = {
  UserPoolId: USER_POOL_ID,
  ClientId: CLIENT_ID!,  // Non-null assertion since we validated above
};
const userPool = new CognitoUserPool(poolData);

export function useAuth() {
  const auth = useOidcAuth();
  const [cognitoUser, setCognitoUser] = useState<CognitoUser | null>(null);
  const [cognitoProfile, setCognitoProfile] = useState<UserProfile>({});
  const [isLoadingCognito, setIsLoadingCognito] = useState(true);

  // Check Cognito session on component mount
  useEffect(() => {
    const checkCognitoSession = () => {
      const currentUser = userPool.getCurrentUser();
      if (currentUser) {
        currentUser.getSession((err: any, session: any) => {
          if (err) {
            console.log('No valid Cognito session:', err);
            setCognitoUser(null);
            setCognitoProfile({});
          } else if (session && session.isValid()) {
            console.log('Valid Cognito session found');
            setCognitoUser(currentUser);
            
            // Get user attributes
            currentUser.getUserAttributes((err, attributes) => {
              if (!err && attributes) {
                const profile: UserProfile = {};
                attributes.forEach((attr) => {
                  if (attr.Name === 'email') profile.email = attr.Value;
                  if (attr.Name === 'preferred_username') profile.preferred_username = attr.Value;
                  if (attr.Name === 'given_name') profile.given_name = attr.Value;
                  if (attr.Name === 'sub') profile.id = attr.Value;
                });
                setCognitoProfile(profile);
              }
            });
          } else {
            setCognitoUser(null);
            setCognitoProfile({});
          }
          setIsLoadingCognito(false);
        });
      } else {
        setCognitoUser(null);
        setCognitoProfile({});
        setIsLoadingCognito(false);
      }
    };

    checkCognitoSession();
  }, []);

  // Combine OIDC and Cognito user profiles
  const userProfile: UserProfile = {
    id: cognitoProfile.id || auth.user?.profile?.sub,
    email: cognitoProfile.email || auth.user?.profile?.email,
    preferred_username: cognitoProfile.preferred_username || cognitoProfile.given_name || auth.user?.profile?.preferred_username,
    given_name: cognitoProfile.given_name,
    nickname: auth.user?.profile?.nickname,
    fullProfile: auth.user?.profile
  };

  // Check if user is authenticated (either via OIDC or Cognito)
  const isAuthenticated = !!(cognitoUser || (auth.user && !auth.isLoading));
  const isLoading = isLoadingCognito || auth.isLoading;

  const signInWithCredentials = async (email: string, password: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const authenticationData = {
        Username: email,
        Password: password,
      };
      
      const authenticationDetails = new AuthenticationDetails(authenticationData);
      
      const userData = {
        Username: email,
        Pool: userPool,
      };
      
      const cognitoUser = new CognitoUser(userData);
      
      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          console.log('Authentication successful');
          // Update local state
          setCognitoUser(cognitoUser);
          
          // Get user attributes
          cognitoUser.getUserAttributes((err, attributes) => {
            if (!err && attributes) {
              const profile: UserProfile = {};
              attributes.forEach((attr) => {
                if (attr.Name === 'email') profile.email = attr.Value;
                if (attr.Name === 'given_name') profile.preferred_username = attr.Value;
                if (attr.Name === 'sub') profile.id = attr.Value;
              });
              setCognitoProfile(profile);
            }
          });
          
          // Just redirect to home - no more Cognito hosted UI
          window.location.href = '/';
          resolve();
        },
        onFailure: (err) => {
          console.error('Authentication failed:', err);
          let errorMessage = 'Authentication failed. Please try again.';
          
          const errorCode = (err as any)?.code;
          if (errorCode === 'NotAuthorizedException') {
            errorMessage = 'Incorrect email or password.';
          } else if (errorCode === 'UserNotConfirmedException') {
            errorMessage = 'Please verify your email address first.';
          } else if (errorCode === 'PasswordResetRequiredException') {
            errorMessage = 'Password reset required. Please reset your password.';
          } else if (errorCode === 'UserNotFoundException') {
            errorMessage = 'No account found with this email address.';
          } else if (errorCode === 'TooManyRequestsException') {
            errorMessage = 'Too many failed attempts. Please try again later.';
          }
          
          reject(new Error(errorMessage));
        },
        newPasswordRequired: (userAttributes, requiredAttributes) => {
          // Handle new password required
          reject(new Error('New password required. Please contact support.'));
        },
        mfaRequired: (challengeName, challengeParameters) => {
          // Handle MFA if enabled
          reject(new Error('MFA required. Please contact support.'));
        }
      });
    });
  };

  const signUpWithCredentials = async (data: SignUpData): Promise<void> => {
    return new Promise((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: data.email,
        }),
        new CognitoUserAttribute({
          Name: 'preferred_username',
          Value: data.firstName, // Use username as preferred_username
        }),
      ];

      userPool.signUp(data.email, data.password, attributeList, [], (err, result) => {
        if (err) {
          console.error('Sign up failed:', err);
          let errorMessage = 'Failed to create account. Please try again.';
          
          const errorCode = (err as any)?.code;
          if (errorCode === 'UsernameExistsException') {
            errorMessage = 'An account with this email already exists.';
          } else if (errorCode === 'InvalidPasswordException') {
            errorMessage = 'Password does not meet requirements.';
          } else if (errorCode === 'InvalidParameterException') {
            errorMessage = 'Invalid email format.';
          }
          
          reject(new Error(errorMessage));
          return;
        }

        console.log('Sign up successful:', result);
        resolve();
      });
    });
  };

  const signOut = async () => {
    try {
      // Sign out from Cognito User Pool first
      if (cognitoUser) {
        cognitoUser.signOut();
        setCognitoUser(null);
        setCognitoProfile({});
      }
      
      // Clear OIDC auth state
      await auth.removeUser();
      
      // Just redirect to home instead of Cognito logout
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  };

  const getAccessToken = (): string | undefined => {
    // First try OIDC token
    if (auth.user?.access_token) {
      return auth.user.access_token;
    }
    
    // Fallback to Cognito session token
    if (cognitoUser) {
      try {
        const session = cognitoUser.getSignInUserSession();
        if (session && session.isValid()) {
          return session.getAccessToken().getJwtToken();
        }
      } catch (error) {
        console.error('Error getting Cognito access token:', error);
      }
    }
    
    return undefined;
  };

  const getIdToken = (): string | undefined => {
    // First try OIDC token
    if (auth.user?.id_token) {
      return auth.user.id_token;
    }
    
    // Fallback to Cognito session token
    if (cognitoUser) {
      try {
        const session = cognitoUser.getSignInUserSession();
        if (session && session.isValid()) {
          return session.getIdToken().getJwtToken();
        }
      } catch (error) {
        console.error('Error getting Cognito ID token:', error);
      }
    }
    
    return undefined;
  };

  const confirmSignUpWithCode = async (email: string, code: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      cognitoUser.confirmRegistration(code, true, (err, result) => {
        if (err) {
          reject(new Error(err.message || 'Failed to confirm account. Please try again.'));
        } else {
          resolve();
        }
      });
    });
  };

  const getUserIdFromToken = (token: string): string | null => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      
      const payload = parts[1];
      const paddedPayload = payload + '='.repeat((4 - payload.length % 4) % 4);
      const decoded = atob(paddedPayload);
      const parsed = JSON.parse(decoded);
      
      return parsed.sub || null;
    } catch {
      return null;
    }
  };

  const callPostSignupEndpoint = async (userData: { email: string; preferred_username: string; emailNotifications?: boolean }, acceptedTos: boolean = false): Promise<void> => {
    try {
      const token = getIdToken();
      if (!token) {
        console.error('No ID token available for post-signup call');
        return;
      }

      const userId = getUserIdFromToken(token);
      if (!userId) {
        console.error('Could not extract user ID from token');
        return;
      }

      console.log('Calling post-signup endpoint with:', { userId, email: userData.email, preferred_username: userData.preferred_username, emailNotifications: userData.emailNotifications });

      const response = await fetch(ENDPOINTS.POST_SIGNUP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          email: userData.email,
          preferred_username: userData.preferred_username,
          accepted_tos: acceptedTos,
          email_notifications: userData.emailNotifications ?? true
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Post-signup API call failed:', errorData);
        throw new Error(errorData.message || 'Failed to complete signup process');
      }

      const data = await response.json();
      console.log('Post-signup processing completed:', data);
    } catch (error) {
      console.error('Post-signup endpoint call failed:', error);
      // Don't reject here - we don't want to block the user if this fails
      // The Lambda fallback might still handle it
    }
  };

  const resendConfirmationCode = async (email: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({ Username: email, Pool: userPool });
      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          reject(new Error(err.message || 'Failed to resend confirmation code.'));
        } else {
          resolve();
        }
      });
    });
  };

  // Backward compatibility alias for getToken
  const getToken = getIdToken;

  // Function to get auth headers for API calls
  const getAuthHeaders = () => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    try {
      const token = getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn('Failed to get auth token:', error);
    }

    return headers;
  };

  return {
    isAuthenticated,
    isLoading,
    user: auth.user,
    userProfile,
    error: auth.error,
    signInWithCredentials,
    signUpWithCredentials,
    signOut,
    getAccessToken,
    getIdToken,
    getToken, // Add backward compatibility
    getAuthHeaders,
    confirmSignUpWithCode,
    resendConfirmationCode,
    callPostSignupEndpoint
  };
} 