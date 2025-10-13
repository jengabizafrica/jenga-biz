/**
 * Updated Authentication Hook using Edge Functions
 * Replaces direct Supabase auth with secure edge function calls
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiClient, type User, ApiError } from '@/lib/api-client';
import type { Session } from '@supabase/supabase-js';

type EdgeAuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, accountType?: string, inviteCode?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  refreshProfile: () => Promise<void>;
};

const EdgeAuthContext = createContext<EdgeAuthContextType | null>(null);

export const EdgeAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        setTimeout(() => {
          loadUserProfile();
        }, 0);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    // THEN check for existing session
    initializeAuth();

    return () => subscription.unsubscribe();
  }, []);

  const initializeAuth = async () => {
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      if (currentSession?.user) {
        await loadUserProfile();
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error initializing auth:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const profile = await apiClient.getProfile();
      setUser(profile);
      console.log('[EdgeAuth] Profile loaded:', profile.email);
    } catch (error) {
      console.error('Error loading user profile:', error);
      if (error instanceof ApiError && error.error.code === 'AUTH_ERROR') {
        // Token is invalid, sign out
        await signOut();
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error };

      // Profile will be loaded via auth state change listener
      return { error: null };
    } catch (error) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, accountType?: string, inviteCode?: string) => {
    const at = String(accountType || '').toLowerCase();
    const normalized = ['organization','ecosystem enabler','enabler','org'].includes(at) ? 'organization' : 'business';
    const redirectUrl = `${window.location.origin}/`;
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            account_type: normalized,
            invite_code: inviteCode,
          },
        },
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      return { error };
    } catch (error) {
      return { error };
    }
  };

  const refreshProfile = async () => {
    if (!loading) {
      await loadUserProfile();
    }
  };

  return (
    <EdgeAuthContext.Provider value={{ 
      user,
      session,
      loading, 
      signIn, 
      signUp, 
      signOut, 
      resetPassword, 
      refreshProfile 
    }}>
      {children}
    </EdgeAuthContext.Provider>
  );
};

export const useEdgeAuth = (): EdgeAuthContextType => {
  const context = useContext(EdgeAuthContext);
  if (!context) throw new Error('useEdgeAuth must be used within an EdgeAuthProvider');
  return context;
};