import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

type AuthContextType = {
  user: any;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, accountType?: string, inviteCode?: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: any }>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(undefined);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      console.log('[useAuth] auth state changed:', session?.user?.email || null);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      console.log('[useAuth] initial session loaded:', session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, accountType?: string, inviteCode?: string) => {
    console.log('[useAuth] signUp called with:', {
      email,
      fullName,
      accountType,
      inviteCode: inviteCode || 'none'
    });
    
    const at = String(accountType || '').toLowerCase();
    const normalized = ['organization','ecosystem enabler','enabler','org'].includes(at) ? 'organization' : 'business';
    const confirmUrl = `${window.location.origin}/confirm-email`;
    
    console.log('[useAuth] Normalized account type:', normalized);
    console.log('[useAuth] Confirm URL:', confirmUrl);
    console.log('[useAuth] Calling supabase.auth.signUp with options:', {
      email,
      emailRedirectTo: confirmUrl,
      metadata: {
        full_name: fullName,
        account_type: normalized,
        invite_code: inviteCode
      }
    });
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: confirmUrl,
        data: {
          full_name: fullName,
          account_type: normalized,
          invite_code: inviteCode,
        },
      },
    });
    
    console.log('[useAuth] supabase.auth.signUp response:', {
      user: data?.user?.id,
      session: data?.session?.access_token ? 'present' : 'null',
      error: error ? {
        message: error.message,
        status: error.status,
        name: error.name
      } : null
    });
    
    if (error) {
      console.error('[useAuth] Signup error details:', error);
    } else {
      console.log('[useAuth] Signup successful');
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
