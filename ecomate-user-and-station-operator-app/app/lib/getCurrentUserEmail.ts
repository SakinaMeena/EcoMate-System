import { supabase } from "./supabase";

export async function getCurrentUserEmail(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (user?.email) {
      return user.email.trim().toLowerCase();
    }

    return null; // no logged-in user
  } catch (error) {
    console.error('Error getting current user email:', error);
    return null;
  }
}