import { Session } from '@supabase/supabase-js';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import { Driver } from '../types';

interface AuthContextType {
  user: Driver | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    userData: {
      name: string;
      phone: string;
      depot_id?: string | null;
    }
  ) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Driver | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadUserProfile(session.user.id);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', userId)
        .eq('role', 'driver')
        .single();

      if (error) throw error;
      setUser(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    // Verify user is a driver
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', data.user.id)
      .eq('role', 'driver')
      .single();

    if (userError || !userData) {
      await supabase.auth.signOut();
      throw new Error('This account is not registered as a driver');
    }

    setUser(userData);
  };

  const signUp = async (
    email: string,
    password: string,
    userData: {
      name: string;
      phone: string;
      depot_id?: string | null;
    }
  ) => {
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) throw error;
    if (!data.user) throw new Error('Failed to create user');

    const { error: profileError } = await supabase.from('users').insert({
      user_id: data.user.id,
      email,
      password_hash: 'managed_by_auth',
      role: 'driver',
      name: userData.name,
      phone: userData.phone,
      depot_id: userData.depot_id || null,
      points: 0,
    });

    if (profileError) throw profileError;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setSession(null);
  };

  // Sends a password reset email to the given address
  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // Update this to your app's deep link / redirect URL if needed
      redirectTo: 'yourapp://reset-password',
    });
    if (error) throw error;
  };

  // Updates the password for the currently logged-in user
  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
