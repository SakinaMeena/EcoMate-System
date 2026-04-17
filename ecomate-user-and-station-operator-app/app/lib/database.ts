import { supabase } from './supabase';

// ────────────────────────────────────────────────
// Shared Article / Question types
// ────────────────────────────────────────────────
export type Question = {
  question: string;
  options: string[];
  correctIndex: number;
};

export type Article = {
  id: number;
  title: string;
  shortText: string;
  image: string;
  points: number;
  fullText: string;
  questions: Question[];
};

// ────────────────────────────────────────────────
// UserProfile type
// ────────────────────────────────────────────────
export type UserProfile = {
  user_id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  user_address?: string | null;
  points?: number;
  lifetime_points?: number;
  avatar_id?: string | null;
  theme?: string | null;
  avatar_head?: string | null;
  avatar_hair?: string | null;
  avatar_accessory?: string | null;
  unlocked_hairs?: string[] | null;
  unlocked_accessories?: string[] | null;
  quizzes_completed?: number;
  completed_quiz_ids?: number[] | null;
  collections_made?: number;
  role?: string | null;
};

// ────────────────────────────────────────────────
export const loadUserProfile = async (userId: string): Promise<UserProfile | null> => {
  try {
    console.log('Attempting to load user:', userId);

    const { data, error } = await supabase
      .from('users')
      .select(
        'user_id, name, email, phone, user_address, points, lifetime_points, ' +
        'avatar_id, theme, avatar_head, avatar_hair, avatar_accessory, ' +
        'unlocked_hairs, unlocked_accessories, quizzes_completed, completed_quiz_ids'
      )
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error in loadUserProfile:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return null;
    }

    if (!data) {
      console.log(`No profile row found for user ${userId} — treating as new user`);
      return null;
    }

    console.log('Profile loaded for:', data.name || data.user_id);
    return data as UserProfile;
  } catch (e) {
    console.error('Unexpected exception in loadUserProfile:', e);
    return null;
  }
};

// ────────────────────────────────────────────────
export const saveAvatarToDB = async (
  userId: string,
  head: string,
  hair: string,
  accessory: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ avatar_head: head, avatar_hair: hair, avatar_accessory: accessory })
      .eq('user_id', userId);

    if (error) {
      console.error('Error saving avatar:', error.message, error.details);
      return false;
    }
    console.log('Avatar saved');
    return true;
  } catch (e) {
    console.error('saveAvatarToDB failed:', e);
    return false;
  }
};

// ────────────────────────────────────────────────
export const updatePointsInDB = async (
  userId: string,
  newPoints: number,
  lifetimePoints?: number
): Promise<boolean> => {
  try {
    const payload: Partial<UserProfile> = { points: newPoints };
    if (lifetimePoints !== undefined) payload.lifetime_points = lifetimePoints;

    const { error } = await supabase
      .from('users')
      .update(payload)
      .eq('user_id', userId);

    if (error) {
      console.error('Error updating points:', error.message, error.details);
      return false;
    }
    console.log('Points updated');
    return true;
  } catch (e) {
    console.error('updatePointsInDB failed:', e);
    return false;
  }
};

// ────────────────────────────────────────────────
export const saveUnlockedItemsToDB = async (
  userId: string,
  unlockedHairs: string[],
  unlockedAccessories: string[]
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ unlocked_hairs: unlockedHairs, unlocked_accessories: unlockedAccessories })
      .eq('user_id', userId);

    if (error) {
      console.error('Error saving unlocked items:', error.message, error.details);
      return false;
    }
    console.log('Unlocked items saved');
    return true;
  } catch (e) {
    console.error('saveUnlockedItemsToDB failed:', e);
    return false;
  }
};

// ────────────────────────────────────────────────
export const saveCompletedQuizToDB = async (
  userId: string,
  completedQuizIds: number[],
  newQuizzesCompleted: number
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({ completed_quiz_ids: completedQuizIds, quizzes_completed: newQuizzesCompleted })
      .eq('user_id', userId);

    if (error) {
      console.error('Error saving quiz completion:', error.message, error.details);
      return false;
    }
    console.log('Quiz completion saved');
    return true;
  } catch (e) {
    console.error('saveCompletedQuizToDB failed:', e);
    return false;
  }
};

// ────────────────────────────────────────────────
export const saveAllUserData = async (
  userId: string,
  data: {
    points: number;
    lifetimePoints: number;
    avatarHead: string;
    avatarHair: string;
    avatarAccessory: string;
    unlockedHairs: string[];
    unlockedAccessories: string[];
    completedQuizIds: number[];
    quizzesCompleted: number;
  }
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        points: data.points,
        lifetime_points: data.lifetimePoints,
        avatar_head: data.avatarHead,
        avatar_hair: data.avatarHair,
        avatar_accessory: data.avatarAccessory,
        unlocked_hairs: data.unlockedHairs,
        unlocked_accessories: data.unlockedAccessories,
        completed_quiz_ids: data.completedQuizIds,
        quizzes_completed: data.quizzesCompleted,
      })
      .eq('user_id', userId);

    if (error) {
      console.error('Error in saveAllUserData:', error.message, error.details);
      return false;
    }

    console.log('All user data saved in one call');
    return true;
  } catch (e) {
    console.error('saveAllUserData failed:', e);
    return false;
  }
};

// ────────────────────────────────────────────────
export const getLeaderboard = async (
  limit: number = 10,
  filters: {
    state?: string | null;
    city?: string | null;
  } = {}
): Promise<any[]> => {
  try {
    let query = supabase
      .from('users')
      .select('user_id, name, points, avatar_head, avatar_hair, avatar_accessory, role, user_address')
      .eq('role', 'user')
      .order('points', { ascending: false })
      .limit(limit);

    if (filters.state) {
      query = query.ilike('user_address', `%${filters.state}%`);
    }
    if (filters.city) {
      query = query.ilike('user_address', `%${filters.city}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching leaderboard:', error.message, error.details);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error('getLeaderboard failed:', e);
    return [];
  }
};

// ────────────────────────────────────────────────
export const getBadges = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('badges')
      .select('badge_id, name, description, icon_svg_path, unlock_condition, points_required, rarity')
      .order('points_required', { ascending: true });

    if (error) {
      console.error('Error fetching badges:', error.message, error.details);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('getBadges failed:', e);
    return [];
  }
};

// ────────────────────────────────────────────────
export const getUserBadges = async (userId: string): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('user_badges')
      .select('badge_id, unlocked_at, is_equipped')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user badges:', error.message, error.details);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('getUserBadges failed:', e);
    return [];
  }
};

// ────────────────────────────────────────────────
export const getAvatarParts = async () => {
  const { data, error } = await supabase
    .from('avatar_parts')
    .select('category, part_key, url, points_required');

  if (error) {
    console.error('Failed to load avatar parts:', error);
    return { heads: {}, hairs: {}, accessories: {} };
  }

  const maps = {
    heads: {} as Record<string, { url: string; points: number }>,
    hairs: {} as Record<string, { url: string | null; points: number }>,
    accessories: {} as Record<string, { url: string | null; points: number }>,
  };

  data.forEach(row => {
    const entry = { url: row.url, points: row.points_required || 0 };
    if (row.category === 'head') maps.heads[row.part_key] = entry;
    if (row.category === 'hair') maps.hairs[row.part_key] = entry;
    if (row.category === 'accessory') maps.accessories[row.part_key] = entry;
  });

  maps.hairs.none = { url: null, points: 0 };
  maps.accessories.none = { url: null, points: 0 };

  return maps;
};

// ────────────────────────────────────────────────
// Fetch future/extra articles from Supabase.
// IDs 1-6 are hardcoded in the app — the LearnScreen
// deduplicates by id so there is never a conflict.
// Only called if you actually add rows to the articles table.
// ────────────────────────────────────────────────
export const getAdditionalArticles = async (): Promise<Article[]> => {
  try {
    const { data: articles, error: articlesError } = await supabase
      .from('articles')
      .select('id, title, short_text, full_text, image_url, points')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (articlesError) {
      console.error('getAdditionalArticles – articles error:', articlesError.message, articlesError.details);
      return [];
    }

    if (!articles || articles.length === 0) {
      console.log('getAdditionalArticles – no active articles in DB');
      return [];
    }

    const articleIds = articles.map(a => a.id);

    const { data: questions, error: questionsError } = await supabase
      .from('article_questions')
      .select('article_id, question_text, option_a, option_b, option_c, correct_option')
      .in('article_id', articleIds);

    if (questionsError) {
      // Non-fatal: return articles with empty questions rather than fail
      console.error('getAdditionalArticles – questions error:', questionsError.message, questionsError.details);
    }

    const result: Article[] = articles.map(a => ({
      id: Number(a.id),
      title: a.title,
      shortText: a.short_text,
      image: a.image_url,
      points: a.points,
      fullText: a.full_text,
      questions: (questions || [])
        .filter(q => q.article_id === a.id)
        .map(q => ({
          question: q.question_text,
          options: [q.option_a, q.option_b, q.option_c],
          correctIndex: Number(q.correct_option),
        })),
    }));

    console.log(`getAdditionalArticles – loaded ${result.length} article(s) from DB`);
    return result;
  } catch (e) {
    console.error('getAdditionalArticles failed:', e);
    return [];
  }
};