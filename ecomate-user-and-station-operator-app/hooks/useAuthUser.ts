// hooks/useAuthUser.ts

import { useState, useEffect } from 'react';
import { supabase } from '../app/lib/supabase';                  
import { getCurrentUserEmail } from '../app/lib/getCurrentUserEmail';  

type UserInfo = {
  email: string | null;
  role: string | null;
  // add later if needed: station_id?: string; full_name?: string;
};

export function useAuthUser() {
  const [userInfo, setUserInfo] = useState<UserInfo>({
    email: null,
    role: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const email = await getCurrentUserEmail();
      if (!email) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("users")
        .select("role")
        .eq("email", email)
        .single();

      if (error) {
        console.error("Error fetching user role:", error);
      }

      setUserInfo({
        email,
        role: data?.role || "unknown",
      });
      setLoading(false);
    }

    load();
  }, []);

  return { ...userInfo, loading };
}