import React, { useState, useCallback, useEffect, useRef, useContext, createContext, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Alert,
    ScrollView,
    Dimensions,
    FlatList,
    Modal,
    ActivityIndicator,
    Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { TabView, SceneMap, TabBar } from 'react-native-tab-view';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AvatarComposer from '../../components/AvatarComposer';
import AppButton from '../../components/AppButton';
import { Ionicons } from '@expo/vector-icons';
import AppInput from '../../components/AppInput';
import AppText from '../../components/AppText';
import AppTiles from '../../components/AppTiles';
import BackButton from '../../components/BackButton';
import {
    loadUserProfile,
    saveAllUserData,
    getLeaderboard,
    getBadges,
    getUserBadges,
    getAvatarParts,
    getAdditionalArticles,   
} from '../../lib/database';
import { supabase } from '../../lib/supabase';
import { AuthProvider, useAuth } from '../../components/AuthContext';
import { useRouter } from 'expo-router';

import EcoBadge from './assets-g/badges/eco.svg';
import LeafBadge from './assets-g/badges/leaf.svg';
import OilBadge from './assets-g/badges/oil.svg';
import RecyclingBadge from './assets-g/badges/recycling.svg';
import ShieldBadge from './assets-g/badges/shield.svg';
import SustainableBadge from './assets-g/badges/sustainable.svg';
import TrophyBadge from './assets-g/badges/trophy.svg';

// ─── TYPES ────────────────────────────────────────────────────────────────────
type RootStackParamList = {
    Profile: undefined;
    Avatar: undefined;
    Leaderboard: undefined;
    Achievements: undefined;
    Learn: undefined;
};
type ScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;
type HeadType = 'light' | 'mediumLight' | 'medium' | 'dark';
type HairType = 'none' | 'bob' | 'curlyBob' | 'curvyBob' | 'pixie' | 'caesar' | 'mowgli' | 'straightCurvy';
type AccessoryType = 'none' | 'glasses' | 'hat' | 'hijab' | 'sunglasses' | 'turban';
type Avatar = { head: HeadType; hair: HairType; accessory: AccessoryType };
type Question = { question: string; options: string[]; correctIndex: number };
type Article = { id: number; title: string; shortText: string; image: string; points: number; fullText: string; questions: Question[] };
type Player = { username: string; points: number; head: HeadType; hair: HairType; accessory: AccessoryType; isYou?: boolean };

// ─── COLORS ───────────────────────────────────────────────────────────────────
const Colors = {
    primary: '#245B43', secondary: '#81C784', background: '#eef7ec',
    text: '#212121', mutedText: '#757575', error: '#D32F2F', icon: '#FFFFFF',
    divider: '#D7E5DD', white: '#FFFFFF', card: 'rgb(184, 204, 191)',
    roleButton: '#1F7A55', pillButton: '#2AA876', inputBg: '#FFFFFF',
    ecoGreenDark: '#245B43', ecoGreenBright: '#0B8F54',
    ecoCardBg: '#D8EEE3', ecoTileBg: '#E3F4EA', ecoTileIconBg: '#c6e5d5',
};

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const headOptions: HeadType[] = ['light', 'mediumLight', 'medium', 'dark'];
const hairOptions: HairType[] = ['none', 'bob', 'curlyBob', 'curvyBob', 'pixie', 'caesar', 'mowgli', 'straightCurvy'];
const accessoryOptions: AccessoryType[] = ['none', 'glasses', 'hat', 'hijab', 'sunglasses', 'turban'];
const defaultUnlockedHairs: HairType[] = ['none', 'bob', 'curlyBob', 'curvyBob'];
const defaultUnlockedAccessories: AccessoryType[] = ['none', 'glasses', 'hat', 'hijab'];
const unlockRequirements: Record<string, number> = {
    straightCurvy: 200, pixie: 200, caesar: 300, mowgli: 300, sunglasses: 300, turban: 500,
};

const DAILY_OPENED_KEY = 'eco_daily_opened';
const DAILY_QUIZ_ATTEMPTS_KEY = 'eco_daily_quiz_attempts';

// ─── REACT CONTEXT ────────────────────────────────────────────────────────────
type EcoData = {
    points: number;
    lifetimePoints: number;
    avatar: Avatar;
    userName: string;
    unlockedHairs: HairType[];
    unlockedAccessories: AccessoryType[];
    quizzesCompleted: number;
    completedQuizIds: number[];
    collectionsMade: number;
    dailyOpenedArticleId: number | null;
    dailyOpenedDate: string | null;
    quizAttempts: Record<number, { count: number; date: string }>;
};

type EcoState = EcoData & {
    addPoints: (n: number) => void;
    spendPoints: (n: number) => void;
    setAvatar: (av: Avatar) => void;
    setUserName: (name: string) => void;
    unlockHair: (h: HairType) => void;
    unlockAccessory: (a: AccessoryType) => void;
    completeQuiz: (id: number, pts: number) => void;
    setCollectionsMade: (n: number) => void;
    setDailyOpened: (articleId: number) => void;
    recordQuizAttempt: (articleId: number) => void;
    hydrate: (data: Partial<EcoData>) => void;
    reset: () => void;
};

const defaultEcoState: EcoState = {
    points: 0, lifetimePoints: 0,
    avatar: { head: 'light', hair: 'none', accessory: 'none' },
    userName: 'User',
    unlockedHairs: [...defaultUnlockedHairs],
    unlockedAccessories: [...defaultUnlockedAccessories],
    quizzesCompleted: 0, completedQuizIds: [], collectionsMade: 0,
    dailyOpenedArticleId: null,
    dailyOpenedDate: null,
    quizAttempts: {},
    addPoints: () => { }, spendPoints: () => { }, setAvatar: () => { },
    setUserName: () => { }, unlockHair: () => { }, unlockAccessory: () => { },
    completeQuiz: () => { }, setCollectionsMade: () => { },
    setDailyOpened: () => { }, recordQuizAttempt: () => { }, hydrate: () => { }, reset: () => { },
};

const EcoContext = createContext<EcoState>(defaultEcoState);
const useEco = () => useContext(EcoContext);

function EcoProvider({ children }: { children: React.ReactNode }) {
    const [points, setPoints] = useState(0);
    const [lifetimePoints, setLifetimePoints] = useState(0);
    const [avatar, setAvatarState] = useState<Avatar>({ head: 'light', hair: 'none', accessory: 'none' });
    const [userName, setUserNameState] = useState('User');
    const [unlockedHairs, setUnlockedHairs] = useState<HairType[]>([...defaultUnlockedHairs]);
    const [unlockedAccessories, setUnlockedAccessories] = useState<AccessoryType[]>([...defaultUnlockedAccessories]);
    const [quizzesCompleted, setQuizzesCompleted] = useState(0);
    const [completedQuizIds, setCompletedQuizIds] = useState<number[]>([]);
    const [collectionsMade, setCollectionsMade] = useState(0);
    const [dailyOpenedArticleId, setDailyOpenedArticleId] = useState<number | null>(null);
    const [dailyOpenedDate, setDailyOpenedDate] = useState<string | null>(null);
    const [quizAttempts, setQuizAttempts] = useState<Record<number, { count: number; date: string }>>({});

    useEffect(() => {
        AsyncStorage.getItem(DAILY_OPENED_KEY).then(raw => {
            if (!raw) return;
            try {
                const { articleId, date } = JSON.parse(raw);
                setDailyOpenedArticleId(articleId ?? null);
                setDailyOpenedDate(date ?? null);
            } catch { }
        });
        AsyncStorage.getItem(DAILY_QUIZ_ATTEMPTS_KEY).then(raw => {
            if (!raw) return;
            try { setQuizAttempts(JSON.parse(raw)); } catch { }
        });
    }, []);

    const addPoints = (n: number) => { setPoints(p => p + n); setLifetimePoints(p => p + n); };
    const spendPoints = (n: number) => setPoints(p => Math.max(0, p - n));
    const setAvatar = (av: Avatar) => setAvatarState(av);
    const setUserName = (name: string) => setUserNameState(name);
    const unlockHair = (h: HairType) => setUnlockedHairs(prev => prev.includes(h) ? prev : [...prev, h]);
    const unlockAccessory = (a: AccessoryType) => setUnlockedAccessories(prev => prev.includes(a) ? prev : [...prev, a]);
    const completeQuiz = (id: number, pts: number) => {
        setPoints(p => p + pts);
        setLifetimePoints(p => p + pts);
        setQuizzesCompleted(q => q + 1);
        setCompletedQuizIds(ids => [...ids, id]);
    };

    const setDailyOpened = (articleId: number) => {
        const today = new Date().toISOString().slice(0, 10);
        setDailyOpenedArticleId(articleId);
        setDailyOpenedDate(today);
        AsyncStorage.setItem(DAILY_OPENED_KEY, JSON.stringify({ articleId, date: today }));
    };

    const recordQuizAttempt = (articleId: number) => {
        const today = new Date().toISOString().slice(0, 10);
        setQuizAttempts(prev => {
            const existing = prev[articleId];
            const count = existing?.date === today ? existing.count + 1 : 1;
            const updated = { ...prev, [articleId]: { count, date: today } };
            AsyncStorage.setItem(DAILY_QUIZ_ATTEMPTS_KEY, JSON.stringify(updated));
            return updated;
        });
    };

    const hydrate = (data: Partial<EcoData>) => {
        if (data.points !== undefined) setPoints(data.points);
        if (data.lifetimePoints !== undefined) setLifetimePoints(data.lifetimePoints);
        if (data.avatar) setAvatarState(data.avatar);
        if (data.userName) setUserNameState(data.userName);
        if (data.unlockedHairs) setUnlockedHairs(data.unlockedHairs as HairType[]);
        if (data.unlockedAccessories) setUnlockedAccessories(data.unlockedAccessories as AccessoryType[]);
        if (data.quizzesCompleted !== undefined) setQuizzesCompleted(data.quizzesCompleted);
        if (data.completedQuizIds) setCompletedQuizIds(data.completedQuizIds);
    };

    const reset = () => {
        setPoints(0); setLifetimePoints(0);
        setAvatarState({ head: 'light', hair: 'none', accessory: 'none' });
        setUserNameState('User');
        setUnlockedHairs([...defaultUnlockedHairs]);
        setUnlockedAccessories([...defaultUnlockedAccessories]);
        setQuizzesCompleted(0); setCompletedQuizIds([]); setCollectionsMade(0);
        setDailyOpenedArticleId(null);
        setDailyOpenedDate(null);
        setQuizAttempts({});
        AsyncStorage.removeItem(DAILY_OPENED_KEY);
        AsyncStorage.removeItem(DAILY_QUIZ_ATTEMPTS_KEY);
    };

    return (
        <EcoContext.Provider value={{
            points, lifetimePoints, avatar, userName,
            unlockedHairs, unlockedAccessories,
            quizzesCompleted, completedQuizIds, collectionsMade,
            dailyOpenedArticleId, dailyOpenedDate,
            quizAttempts,
            addPoints, spendPoints, setAvatar, setUserName,
            unlockHair, unlockAccessory, completeQuiz,
            setCollectionsMade, setDailyOpened, recordQuizAttempt, hydrate, reset,
        }}>
            {children}
        </EcoContext.Provider>
    );
}

// ─── BADGE ALERT TRACKER ──────────────────────────────────────────────────────
const shownBadgeAlerts = new Set<string>();
function checkAndUnlockBadge(id: string, condition: boolean, message: string) {
    if (!condition || shownBadgeAlerts.has(id)) return;
    shownBadgeAlerts.add(id);
    Alert.alert('🏆 Badge Unlocked!', message);
}

// ─── DATA FUNCTIONS ───────────────────────────────────────────────────────────
const loadData = async (userId: string, hydrate: (data: any) => void, setCollectionsMade: (n: number) => void) => {
    try {
        let profile = await loadUserProfile(userId);
        if (!profile) {
            const defaultProfile = {
                user_id: userId, name: 'New Eco User', email: '', phone: '',
                user_address: '', points: 0, lifetime_points: 0,
                avatar_head: 'light', avatar_hair: 'none', avatar_accessory: 'none',
                unlocked_hairs: ['none', 'bob', 'curlyBob', 'curvyBob'],
                unlocked_accessories: ['none', 'glasses', 'hat', 'hijab'],
                quizzes_completed: 0, completed_quiz_ids: [],
            };
            const { error } = await supabase.from('users').insert(defaultProfile);
            if (error) console.error('Failed to INSERT default profile:', error);
            profile = await loadUserProfile(userId);
        }
        if (profile) {
            hydrate({
                points: profile.points || 0,
                lifetimePoints: profile.lifetime_points || profile.points || 0,
                userName: profile.name || 'User',
                avatar: {
                    head: (profile.avatar_head || 'light') as HeadType,
                    hair: (profile.avatar_hair || 'none') as HairType,
                    accessory: (profile.avatar_accessory || 'none') as AccessoryType,
                },
                unlockedHairs: profile.unlocked_hairs?.length ? profile.unlocked_hairs : [...defaultUnlockedHairs],
                unlockedAccessories: profile.unlocked_accessories?.length ? profile.unlocked_accessories : [...defaultUnlockedAccessories],
                quizzesCompleted: profile.quizzes_completed || 0,
                completedQuizIds: profile.completed_quiz_ids || [],
            });
            const { count } = await supabase
                .from('dropoffs').select('*', { count: 'exact', head: true })
                .eq('user_id', userId).eq('status', 'collected');
            setCollectionsMade(count || 0);
        }
    } catch (e) { console.error('loadData failed:', e); }
};

const saveData = async (userId: string, eco: EcoData) => {
    try {
        await saveAllUserData(userId, {
            points: eco.points,
            lifetimePoints: eco.lifetimePoints,
            avatarHead: eco.avatar.head,
            avatarHair: eco.avatar.hair,
            avatarAccessory: eco.avatar.accessory,
            unlockedHairs: eco.unlockedHairs,
            unlockedAccessories: eco.unlockedAccessories,
            completedQuizIds: eco.completedQuizIds,
            quizzesCompleted: eco.quizzesCompleted,
        });
    } catch (e) { console.error('Failed to save data:', e); }
};

// ─── LAYOUT WRAPPER ───────────────────────────────────────────────────────────
function AppLayoutWrapper({ children, showTopDecor = true, useGreenHeader = false }) {
    const backgroundColor = useGreenHeader ? Colors.primary : Colors.background;
    return (
        <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={['top', 'left', 'right']}>
            {showTopDecor && useGreenHeader && (
                <View pointerEvents="none" style={[styles.decorativeTop, { backgroundColor: Colors.primary }]} />
            )}
            <View style={styles.roundedContent}>{children}</View>
        </SafeAreaView>
    );
}

// ─── AVATAR SCREEN ────────────────────────────────────────────────────────────
function AvatarScreen({ navigation }: ScreenProps<'Avatar'>) {
    const router = useRouter();
    const { userId } = useAuth();
    const eco = useEco();

    const [head, setHead] = useState<HeadType>(eco.avatar.head);
    const [hair, setHair] = useState<HairType>(eco.avatar.hair);
    const [accessory, setAccessory] = useState<AccessoryType>(eco.avatar.accessory);
    const [tabIndex, setTabIndex] = useState(0);
    const [avatarParts, setAvatarParts] = useState<{ heads: any; hairs: any; accessories: any }>({ heads: {}, hairs: {}, accessories: {} });

    const pendingUnlockSave = useRef(false);

    const tabRoutes = [
        { key: 'skin', title: 'Skin' },
        { key: 'hair', title: 'Hair' },
        { key: 'accessories', title: 'Accessories' },
    ];
    const numColumns = Dimensions.get('window').width > 500 ? 3 : 2;

    useFocusEffect(useCallback(() => {
        setHead(eco.avatar.head);
        setHair(eco.avatar.hair);
        setAccessory(eco.avatar.accessory);
    }, [eco.avatar]));

    useEffect(() => { getAvatarParts().then(setAvatarParts); }, []);

    useEffect(() => {
        if (!pendingUnlockSave.current || !userId) return;
        pendingUnlockSave.current = false;
        saveData(userId, eco);
    }, [eco.unlockedHairs, eco.unlockedAccessories, eco.points]);

    const handleUnlock = (option: string, category: string) => {
        if (!userId) return;
        const cost = unlockRequirements[option];
        if (!cost) return;
        if (eco.points < cost) {
            Alert.alert('Not Enough Points', `You need ${cost} EcoPoints.\nYou have ${eco.points}.`);
            return;
        }
        pendingUnlockSave.current = true;
        eco.spendPoints(cost);
        if (category === 'hair') { eco.unlockHair(option as HairType); setHair(option as HairType); }
        else if (category === 'accessories') { eco.unlockAccessory(option as AccessoryType); setAccessory(option as AccessoryType); }
        Alert.alert('Unlocked!', `${option} unlocked and equipped!\n(-${cost} EcoPoints)`);
        checkAndUnlockBadge('5',
            eco.unlockedHairs.length + eco.unlockedAccessories.length + 1 >= 5,
            'Shield Badge unlocked!\nYou have customized your avatar beautifully!');
    };

    const renderItem = (option: string, category: string) => {
        const cost = unlockRequirements[option];
        const isDefault =
            category === 'skin' ||
            (category === 'hair' && defaultUnlockedHairs.includes(option as HairType)) ||
            (category === 'accessories' && defaultUnlockedAccessories.includes(option as AccessoryType));
        const isUnlocked =
            isDefault ||
            (category === 'hair' ? eco.unlockedHairs.includes(option as HairType) : eco.unlockedAccessories.includes(option as AccessoryType));
        const isSelected =
            (category === 'skin' && head === option) ||
            (category === 'hair' && hair === option) ||
            (category === 'accessories' && accessory === option);

        const renderPreview = () => {
            if (option === 'none') return <View style={{ width: 60, height: 60 }} />;
            let url: string | undefined;
            if (category === 'skin') url = avatarParts.heads[option]?.url;
            else if (category === 'hair') url = avatarParts.hairs[option]?.url;
            else if (category === 'accessories') url = avatarParts.accessories[option]?.url;
            return (
                <View style={{ width: 60, height: 60, justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Image source={{ uri: url || `https://via.placeholder.com/60?text=${option}` }} style={{ width: '100%', height: '100%' }} contentFit="contain" transition={100} cachePolicy="memory-disk" />
                </View>
            );
        };

        return (
            <TouchableOpacity
                key={option}
                style={[styles.item, !isUnlocked && cost ? styles.locked : null, isSelected ? styles.selected : null]}
                onPress={() => {
                    if (isUnlocked || isDefault) {
                        if (category === 'skin') setHead(option as HeadType);
                        else if (category === 'hair') setHair(option as HairType);
                        else if (category === 'accessories') setAccessory(option as AccessoryType);
                    } else if (cost) { handleUnlock(option, category); }
                }}
            >
                <View style={styles.previewMini}>{renderPreview()}</View>
                <Text style={styles.itemText}>{option === 'none' ? 'None' : option.replace(/([A-Z])/g, ' $1').trim()}</Text>
                {!isUnlocked && cost && <Text style={styles.lockText}>Unlock for {cost} pts</Text>}
            </TouchableOpacity>
        );
    };

    const SkinRoute = () => (
        <ScrollView contentContainerStyle={styles.gridContainer}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {headOptions.map(opt => <View key={opt} style={{ width: `${100 / numColumns}%`, padding: 4 }}>{renderItem(opt, 'skin')}</View>)}
            </View>
        </ScrollView>
    );
    const HairRoute = () => (
        <ScrollView contentContainerStyle={styles.gridContainer}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {hairOptions.map(opt => <View key={opt} style={{ width: `${100 / numColumns}%`, padding: 4 }}>{renderItem(opt, 'hair')}</View>)}
            </View>
        </ScrollView>
    );
    const AccessoriesRoute = () => (
        <ScrollView contentContainerStyle={styles.gridContainer}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                {accessoryOptions.map(opt => <View key={opt} style={{ width: `${100 / numColumns}%`, padding: 4 }}>{renderItem(opt, 'accessories')}</View>)}
            </View>
        </ScrollView>
    );

    const tabRenderScene = SceneMap({ skin: SkinRoute, hair: HairRoute, accessories: AccessoriesRoute });

    return (
        <AppLayoutWrapper showTopDecor={false} useGreenHeader={false}>
            <View style={styles.pageHeaderRow}>
                <BackButton style={styles.backIconBtn} />
                <AppText variant="header" style={styles.pageHeaderTitle}>Customize Avatar</AppText>
                <Pressable onPress={() => router.push('/(main)/(user)/userHome')} hitSlop={12} style={styles.homeBtn}>
                    <Ionicons name="home-sharp" size={24} color={Colors.primary} />
                </Pressable>
            </View>
            <View style={styles.avatarContent}>
                <View style={styles.avatarCenterContainer}>
                    <View style={styles.avatarPreviewCircle}>
                        <AvatarComposer
                            head={head} hair={hair} accessory={accessory}
                            headUrl={avatarParts.heads[head]?.url || 'https://via.placeholder.com/240?text=Head'}
                            hairUrl={hair !== 'none' ? avatarParts.hairs[hair]?.url : null}
                            accessoryUrl={accessory !== 'none' ? avatarParts.accessories[accessory]?.url : null}
                            size={240} showLevel={false}
                        />
                    </View>
                </View>
                <View style={styles.pointsRow}>
                    <Text style={styles.pointsText}>EcoPoints: {eco.points}</Text>
                </View>
                <TabView
                    navigationState={{ index: tabIndex, routes: tabRoutes }}
                    renderScene={tabRenderScene}
                    onIndexChange={setTabIndex}
                    initialLayout={{ width: Dimensions.get('window').width }}
                    renderTabBar={props => <TabBar {...props} style={styles.tabBar} />}
                />
                <View style={styles.twoButtonRow}>
                    <AppButton title="Reset" onPress={() =>
                        Alert.alert('Reset Avatar?', 'Go back to default?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Reset', onPress: () => {
                                    const def = { head: 'light' as HeadType, hair: 'none' as HairType, accessory: 'none' as AccessoryType };
                                    setHead('light'); setHair('none'); setAccessory('none');
                                    eco.setAvatar(def);
                                    if (userId) saveData(userId, { ...eco, avatar: def });
                                }
                            },
                        ])
                    } variant="outline" style={styles.halfBtn} />
                    <AppButton title="Save" onPress={() => {
                        eco.setAvatar({ head, hair, accessory });
                        if (userId) saveData(userId, { ...eco, avatar: { head, hair, accessory } });
                        Alert.alert('Avatar Saved!');
                    }} variant="save" style={styles.halfBtn} />
                </View>
            </View>
        </AppLayoutWrapper>
    );
}

// ─── PROFILE SCREEN ───────────────────────────────────────────────────────────
function MyProfileScreen({ navigation }: ScreenProps<'Profile'>) {
    const router = useRouter();
    const { userId } = useAuth();
    const eco = useEco();

    const [recentCollections, setRecentCollections] = useState<any[]>([]);
    const [userEmail, setUserEmail] = useState('');
    const [userPhone, setUserPhone] = useState('');
    const [userAddress, setUserAddress] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [editedEmail, setEditedEmail] = useState('');
    const [editedPhone, setEditedPhone] = useState('');
    const [editedAddress, setEditedAddress] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [avatarParts, setAvatarParts] = useState<{ heads: any; hairs: any; accessories: any }>({ heads: {}, hairs: {}, accessories: {} });

    useFocusEffect(useCallback(() => {
        if (!userId) return;
        const load = async () => {
            const profile = await loadUserProfile(userId);
            if (profile) {
                setUserEmail(profile.email || 'No email');
                setUserPhone(profile.phone || 'No phone');
                setUserAddress(profile.user_address || 'No address set');
            }
            const { data: collData } = await supabase
                .from('dropoffs')
                .select('dropoff_id, actual_volume, collected_at, dropoff_type')
                .eq('user_id', userId).eq('status', 'collected')
                .order('collected_at', { ascending: false }).limit(5);
            setRecentCollections(collData || []);
        };
        load();
    }, [userId]));

    useEffect(() => { getAvatarParts().then(setAvatarParts); }, []);

    const handleEdit = () => {
        setEditedName(eco.userName); setEditedEmail(userEmail);
        setEditedPhone(userPhone); setEditedAddress(userAddress);
        setNewPassword(''); setConfirmPassword('');
        setIsEditing(true);
    };

    const handleSave = async () => {
        if (!userId) return;
        if (newPassword || confirmPassword) {
            if (newPassword !== confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
            if (newPassword.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
        }
        try {
            const { error: profileError } = await supabase.from('users')
                .update({ name: editedName, email: editedEmail, phone: editedPhone, user_address: editedAddress })
                .eq('user_id', userId);
            if (profileError) { Alert.alert('Error', 'Failed to update profile'); return; }
            if (newPassword) {
                const { error: passwordError } = await supabase.auth.updateUser({ password: newPassword });
                if (passwordError) { Alert.alert('Error', 'Failed to update password: ' + passwordError.message); return; }
            }
            eco.setUserName(editedName);
            setUserEmail(editedEmail); setUserPhone(editedPhone); setUserAddress(editedAddress);
            setIsEditing(false);
            Alert.alert('Success', newPassword ? 'Profile and password updated!' : 'Profile updated!');
        } catch (e) { Alert.alert('Error', 'Something went wrong'); }
    };

    const level = Math.floor(eco.lifetimePoints / 500) + 1;
    const progressToNext = ((eco.lifetimePoints % 500) / 500) * 100;
    const unlockedItemsCount = eco.unlockedHairs.length + eco.unlockedAccessories.length;

    return (
        <AppLayoutWrapper showTopDecor={false} useGreenHeader={false}>
            <View style={styles.profileHeaderRow}>
                <View style={{ width: 44 }} />
                <AppText variant="header" style={styles.profileHeaderTitle}>My Profile</AppText>
                <Pressable onPress={() => router.push('/(main)/(user)/userHome')} hitSlop={12} style={styles.homeBtn}>
                    <Ionicons name="home-sharp" size={24} color={Colors.primary} />
                </Pressable>
            </View>
            <ScrollView style={styles.profileContainer} showsVerticalScrollIndicator={false}>
                <View style={styles.avatarSection}>
                    <View style={[styles.avatarCircle, { backgroundColor: 'transparent' }]}>
                        <AvatarComposer
                            head={eco.avatar.head} hair={eco.avatar.hair} accessory={eco.avatar.accessory}
                            headUrl={avatarParts.heads[eco.avatar.head]?.url || 'https://via.placeholder.com/120?text=Head'}
                            hairUrl={eco.avatar.hair !== 'none' ? avatarParts.hairs[eco.avatar.hair]?.url : null}
                            accessoryUrl={eco.avatar.accessory !== 'none' ? avatarParts.accessories[eco.avatar.accessory]?.url : null}
                            size={120} showLevel={false} points={eco.lifetimePoints}
                        />
                    </View>
                    <AppText variant="sectionTitle" style={styles.profileName}>{eco.userName}</AppText>
                    <View style={styles.statsRow}>
                        <View style={styles.statMini}>
                            <AppText style={styles.statMiniNumber}>{eco.points}</AppText>
                            <AppText variant="caption" style={styles.statMiniLabel}>Points</AppText>
                        </View>
                    </View>
                </View>

                <View style={styles.progressCard}>
                    <View style={styles.progressRow}>
                        <AppText variant="caption" style={styles.progressLabel}>Level {level}</AppText>
                        <AppText variant="caption" style={styles.progressLabel}>Level {level + 1}</AppText>
                    </View>
                    <View style={styles.progressOuter}>
                        <View style={[styles.progressInner, { width: `${progressToNext}%` as any }]} />
                    </View>
                    <AppText variant="caption" style={styles.progressText}>{Math.round(progressToNext)}% to level {level + 1}</AppText>
                </View>

                <View style={styles.userInfoCard}>
                    <View style={styles.infoCardHeader}>
                        <AppText variant="sectionTitle" style={styles.userInfoTitle}>Account Information</AppText>
                        {!isEditing && <AppButton title="Edit" onPress={handleEdit} variant="outline" style={styles.editChipBtn} />}
                    </View>
                    {!isEditing ? (
                        <>
                            <View style={styles.userInfoRow}><AppText variant="caption" style={styles.userInfoLabel}>Username:</AppText><AppText style={styles.userInfoValue}>{eco.userName}</AppText></View>
                            <View style={styles.userInfoRow}><AppText variant="caption" style={styles.userInfoLabel}>Email:</AppText><AppText style={styles.userInfoValue}>{userEmail}</AppText></View>
                            <View style={styles.userInfoRow}><AppText variant="caption" style={styles.userInfoLabel}>Phone:</AppText><AppText style={styles.userInfoValue}>{userPhone}</AppText></View>
                            <View style={styles.userInfoRow}><AppText variant="caption" style={styles.userInfoLabel}>Address:</AppText><AppText style={styles.userInfoValue} numberOfLines={2}>{userAddress}</AppText></View>
                            <View style={styles.userInfoRow}><AppText variant="caption" style={styles.userInfoLabel}>Password:</AppText><AppText style={styles.userInfoValue}>••••••••</AppText></View>
                        </>
                    ) : (
                        <>
                            <AppInput label="Username" icon="person-outline" value={editedName} onChangeText={setEditedName} placeholder="Enter username" autoCapitalize="words" />
                            <AppInput label="Email" icon="mail-outline" value={editedEmail} onChangeText={setEditedEmail} placeholder="Enter email" keyboardType="email-address" autoCapitalize="none" />
                            <AppInput label="Phone" icon="call-outline" value={editedPhone} onChangeText={setEditedPhone} placeholder="Enter phone number" keyboardType="phone-pad" />
                            <AppInput label="Address" icon="location-outline" value={editedAddress} onChangeText={setEditedAddress} placeholder="Enter address" multiline numberOfLines={3} containerStyle={styles.addressInput} />
                            <AppInput label="New Password (optional)" icon="lock-closed-outline" value={newPassword} onChangeText={setNewPassword} placeholder="Enter new password" secureTextEntry helperText="Leave blank to keep current password" />
                            <AppInput label="Confirm Password" icon="lock-closed-outline" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" secureTextEntry />
                            <View style={styles.twoButtonRow}>
                                <AppButton title="Cancel" onPress={() => setIsEditing(false)} variant="cancel" style={styles.halfBtn} />
                                <AppButton title="Save" onPress={handleSave} variant="save" style={styles.halfBtn} />
                            </View>
                        </>
                    )}
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statBox}><AppText style={styles.statNumber}>{eco.quizzesCompleted}</AppText><AppText variant="caption" style={styles.statLabel}>{'Quizzes\nCompleted'}</AppText></View>
                    <View style={styles.statBox}><AppText style={styles.statNumber}>{unlockedItemsCount}</AppText><AppText variant="caption" style={styles.statLabel}>{'Items\nUnlocked'}</AppText></View>
                    <View style={styles.statBox}><AppText style={styles.statNumber}>{eco.collectionsMade}</AppText><AppText variant="caption" style={styles.statLabel}>{'Collections\nMade'}</AppText></View>
                </View>

                <View style={styles.userInfoCard}>
                    <AppText variant="sectionTitle" style={styles.userInfoTitle}>Recent Collections</AppText>
                    {recentCollections.length === 0 ? (
                        <Text style={{ color: Colors.mutedText, textAlign: 'center', paddingVertical: 20 }}>No verified collections yet — schedule a pickup or scan a station QR!</Text>
                    ) : (
                        recentCollections.map((c: any) => (
                            <View key={c.dropoff_id} style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.divider }}>
                                <View>
                                    <Text style={{ fontWeight: '600', color: Colors.primary }}>{c.dropoff_type === 'home_pickup' ? ' Home Pickup' : 'Station Drop-off'}</Text>
                                    <Text style={{ color: Colors.mutedText, fontSize: 13 }}>{new Date(c.collected_at).toLocaleDateString('en-MY')} • {c.actual_volume} L</Text>
                                </View>
                            </View>
                        ))
                    )}
                </View>

                <View style={styles.tilesSection}>
                    <AppTiles data={[
                        { title: 'Achievement', icon: 'trophy-outline', onPress: () => navigation.navigate('Achievements') },
                        { title: 'Leaderboard', icon: 'stats-chart-outline', onPress: () => navigation.navigate('Leaderboard') },
                        { title: 'Educational Content', icon: 'book-outline', onPress: () => navigation.navigate('Learn') },
                        { title: 'Customize Avatar', icon: 'person-circle-outline', onPress: () => navigation.navigate('Avatar') },
                    ]} />
                </View>
            </ScrollView>
        </AppLayoutWrapper>
    );
}

// ─── ACHIEVEMENTS SCREEN ──────────────────────────────────────────────────────
function AchievementsScreen({ navigation }: ScreenProps<'Achievements'>) {
    const router = useRouter();
    const eco = useEco();
    const [selectedBadge, setSelectedBadge] = useState<any | null>(null);
    const [supabaseBadges, setSupabaseBadges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const level = Math.floor(eco.lifetimePoints / 500) + 1;
    const unlockedCount = eco.unlockedHairs.length + eco.unlockedAccessories.length;

    const getUnlocked = (id: string) => {
        switch (id) {
            case '1': return eco.lifetimePoints >= 100 || eco.quizzesCompleted >= 1;
            case '2': return eco.quizzesCompleted >= 5;
            case '3': return eco.collectionsMade >= 1;
            case '4': return eco.collectionsMade >= 10;
            case '5': return unlockedCount >= 5;
            case '6': return level >= 3;
            case '7': return eco.lifetimePoints >= 3000;
            default: return false;
        }
    };

    const getDescription = (id: string, unlocked: boolean) => {
        if (unlocked) {
            switch (id) {
                case '1': return 'Unlocked by completing your first quiz or reaching 100 points!';
                case '2': return 'Unlocked after completing 5 quizzes!';
                case '3': return 'Unlocked after your first collection!';
                case '4': return 'Unlocked after 10 collections!';
                case '5': return 'Unlocked after unlocking 5 avatar items!';
                case '6': return 'Unlocked by reaching Level 3!';
                case '7': return 'Unlocked by reaching 3000 EcoPoints!';
                default: return 'Unlocked!';
            }
        }
        switch (id) {
            case '1': return 'Locked – Complete your first quiz or reach 100 points';
            case '2': return 'Locked – Complete 5 quizzes';
            case '3': return 'Locked – Make your first collection';
            case '4': return 'Locked – Make 10 collections';
            case '5': return 'Locked – Unlock 5 avatar items';
            case '6': return 'Locked – Reach Level 3';
            case '7': return 'Locked – Reach 3000 EcoPoints';
            default: return 'Locked – Keep going!';
        }
    };

    const hardcodedBadges = [
        { id: '1', name: 'Eco Badge', SvgComponent: EcoBadge, unlocked: getUnlocked('1'), isHardcoded: true },
        { id: '2', name: 'Leaf Badge', SvgComponent: LeafBadge, unlocked: getUnlocked('2'), isHardcoded: true },
        { id: '3', name: 'Oil Badge', SvgComponent: OilBadge, unlocked: getUnlocked('3'), isHardcoded: true },
        { id: '4', name: 'Recycling Badge', SvgComponent: RecyclingBadge, unlocked: getUnlocked('4'), isHardcoded: true },
        { id: '5', name: 'Shield Badge', SvgComponent: ShieldBadge, unlocked: getUnlocked('5'), isHardcoded: true },
        { id: '6', name: 'Sustainable Badge', SvgComponent: SustainableBadge, unlocked: getUnlocked('6'), isHardcoded: true },
        { id: '7', name: 'Trophy Badge', SvgComponent: TrophyBadge, unlocked: getUnlocked('7'), isHardcoded: true },
    ];

    const checkSupabaseBadgeUnlocked = (badge: any): boolean => {
        const condition = badge.unlock_condition.toLowerCase();
        if (condition.includes('points') || condition.includes('earn')) return eco.lifetimePoints >= badge.points_required;
        if (condition.includes('10 quiz')) return eco.quizzesCompleted >= 10;
        if (condition.includes('7 quiz')) return eco.quizzesCompleted >= 7;
        if (condition.includes('5 quiz')) return eco.quizzesCompleted >= 5;
        if (condition.includes('2 quiz')) return eco.quizzesCompleted >= 2;
        if (condition.includes('15 collection')) return eco.collectionsMade >= 15;
        if (condition.includes('8 collection')) return eco.collectionsMade >= 8;
        if (condition.includes('3 collection')) return eco.collectionsMade >= 3;
        if (condition.includes('8 avatar')) return unlockedCount >= 8;
        if (condition.includes('3 avatar')) return unlockedCount >= 3;
        if (condition.includes('level 2')) return level >= 2;
        return false;
    };

    useFocusEffect(useCallback(() => {
        const fetchBadges = async () => {
            setLoading(true);
            try {
                const badges = await getBadges();
                setSupabaseBadges(badges.map(b => ({ ...b, unlocked: checkSupabaseBadgeUnlocked(b), isHardcoded: false })));
            } catch { setSupabaseBadges([]); }
            setLoading(false);
        };
        fetchBadges();
    }, []));

    if (loading) {
        return (<AppLayoutWrapper><View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={Colors.primary} /><Text style={{ color: Colors.primary, marginTop: 16 }}>Loading badges...</Text></View></AppLayoutWrapper>);
    }

    const allBadges = [...hardcodedBadges, ...supabaseBadges];

    const renderBadge = ({ item }: { item: any }) => (
        <TouchableOpacity style={[styles.badgeCard, !item.unlocked ? { opacity: 0.75 } : null]} onPress={() => setSelectedBadge(item)}>
            <View style={styles.badgeIconContainer}>
                <View style={{ width: 80, height: 80, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}>
                    {item.isHardcoded
                        ? <item.SvgComponent width={80} height={80} style={!item.unlocked ? styles.badgeSvgLocked : null} />
                        : <Image source={{ uri: item.icon_svg_path }} style={{ width: 80, height: 80, opacity: item.unlocked ? 1 : 0.55 }} contentFit="contain" cachePolicy="memory-disk" />
                    }
                </View>
            </View>
            <Text style={styles.badgeTitle} numberOfLines={2}>{item.name}</Text>
            {item.unlocked && <Text style={styles.badgeUnlocked}>Unlocked</Text>}
        </TouchableOpacity>
    );

    return (
        <AppLayoutWrapper showTopDecor={false} useGreenHeader={false}>
            <View style={styles.pageHeaderRow}>
                <BackButton style={styles.backIconBtn} />
                <AppText variant="header" style={styles.pageHeaderTitle}>Achievements</AppText>
                <Pressable onPress={() => router.push('/(main)/(user)/userHome')} hitSlop={12} style={styles.homeBtn}>
                    <Ionicons name="home-sharp" size={24} color={Colors.primary} />
                </Pressable>
            </View>
            <View style={styles.achievementsContainer}>
                <FlatList data={allBadges} renderItem={renderBadge} keyExtractor={item => item.id || item.badge_id} numColumns={3} contentContainerStyle={styles.badgeGrid} columnWrapperStyle={{ justifyContent: 'space-between' }} />
                <Modal visible={!!selectedBadge} transparent animationType="fade" onRequestClose={() => setSelectedBadge(null)}>
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalCard}>
                            {selectedBadge && (<>
                                {selectedBadge.isHardcoded
                                    ? <selectedBadge.SvgComponent width={140} height={140} style={!selectedBadge.unlocked ? styles.badgeSvgLocked : null} />
                                    : <Image source={{ uri: selectedBadge.icon_svg_path }} style={{ width: 140, height: 140, opacity: selectedBadge.unlocked ? 1 : 0.55 }} contentFit="contain" cachePolicy="memory-disk" />
                                }
                                <Text style={styles.modalTitle}>{selectedBadge.name}</Text>
                                <Text style={styles.modalReason}>
                                    {selectedBadge.isHardcoded
                                        ? getDescription(selectedBadge.id, selectedBadge.unlocked)
                                        : selectedBadge.unlocked ? `Unlocked by reaching ${selectedBadge.unlock_condition}` : `Locked – ${selectedBadge.unlock_condition}`}
                                </Text>
                                <AppButton title="Close" onPress={() => setSelectedBadge(null)} variant="role" fullWidth />
                            </>)}
                        </View>
                    </View>
                </Modal>
            </View>
        </AppLayoutWrapper>
    );
}

// ─── LEADERBOARD SCREEN ───────────────────────────────────────────────────────
function LeaderboardScreen({ navigation }: ScreenProps<'Leaderboard'>) {
    const router = useRouter();
    const { userId } = useAuth();
    const [leaderboardData, setLeaderboardData] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [avatarParts, setAvatarParts] = useState<{ heads: any; hairs: any; accessories: any }>({ heads: {}, hairs: {}, accessories: {} });
    const [selectedState, setSelectedState] = useState<string | null>(null);
    const [selectedCity, setSelectedCity] = useState<string | null>(null);

    useFocusEffect(useCallback(() => {
        const fetch = async () => {
            setLoading(true);
            const data = await getLeaderboard(10, { state: selectedState, city: selectedCity });
            setLeaderboardData(data.map(u => ({
                username: u.name, points: u.points,
                head: (u.avatar_head || 'light') as HeadType,
                hair: (u.avatar_hair || 'none') as HairType,
                accessory: (u.avatar_accessory || 'none') as AccessoryType,
                isYou: u.user_id === userId,
            })));
            setLoading(false);
        };
        fetch();
    }, [userId, selectedState, selectedCity]));

    useEffect(() => { getAvatarParts().then(setAvatarParts); }, []);

    const sortedPlayers = [...leaderboardData].sort((a, b) => b.points - a.points);
    const top3 = sortedPlayers.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]];

    return (
        <AppLayoutWrapper showTopDecor={false} useGreenHeader={false}>
            <View style={styles.pageHeaderRow}>
                <BackButton style={styles.backIconBtn} />
                <AppText variant="header" style={styles.pageHeaderTitle}>Leaderboard</AppText>
                <Pressable onPress={() => router.push('/(main)/(user)/userHome')} hitSlop={12} style={styles.homeBtn}>
                    <Ionicons name="home-sharp" size={24} color={Colors.primary} />
                </Pressable>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4, gap: 10 }}>
                <AppButton title="State" onPress={() => Alert.alert('Select State', '', [
                    { text: 'All States', onPress: () => { setSelectedState(null); setSelectedCity(null); } },
                    { text: 'Johor', onPress: () => setSelectedState('Johor') },
                    { text: 'Kedah', onPress: () => setSelectedState('Kedah') },
                    { text: 'Kelantan', onPress: () => setSelectedState('Kelantan') },
                    { text: 'Melaka', onPress: () => setSelectedState('Melaka') },
                    { text: 'Negeri Sembilan', onPress: () => setSelectedState('Negeri Sembilan') },
                    { text: 'Pahang', onPress: () => setSelectedState('Pahang') },
                    { text: 'Penang', onPress: () => setSelectedState('Penang') },
                    { text: 'Perak', onPress: () => setSelectedState('Perak') },
                    { text: 'Perlis', onPress: () => setSelectedState('Perlis') },
                    { text: 'Sabah', onPress: () => setSelectedState('Sabah') },
                    { text: 'Sarawak', onPress: () => setSelectedState('Sarawak') },
                    { text: 'Selangor', onPress: () => setSelectedState('Selangor') },
                    { text: 'Terengganu', onPress: () => setSelectedState('Terengganu') },
                    { text: 'Kuala Lumpur', onPress: () => setSelectedState('Kuala Lumpur') },
                    { text: 'Labuan', onPress: () => setSelectedState('Labuan') },
                    { text: 'Putrajaya', onPress: () => setSelectedState('Putrajaya') },
                    { text: 'Cancel', style: 'cancel' },
                ])} variant="outline" style={styles.editChipBtn} />
                <AppButton
                    title="City"
                    onPress={() => {
                        if (!selectedState) return;
                        Alert.alert('Select City', '', [
                            { text: 'All Cities', onPress: () => setSelectedCity(null) },
                            { text: 'Petaling Jaya', onPress: () => setSelectedCity('Petaling Jaya') },
                            { text: 'Shah Alam', onPress: () => setSelectedCity('Shah Alam') },
                            { text: 'Subang Jaya', onPress: () => setSelectedCity('Subang Jaya') },
                            { text: 'Kuala Lumpur', onPress: () => setSelectedCity('Kuala Lumpur') },
                            { text: 'Ipoh', onPress: () => setSelectedCity('Ipoh') },
                            { text: 'Cancel', style: 'cancel' },
                        ]);
                    }}
                    variant="outline"
                    disabled={!selectedState}
                    style={styles.editChipBtn}
                />
            </View>
            {(selectedState || selectedCity) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 6, backgroundColor: '#e8f5e9', gap: 8 }}>
                    {selectedState && <View style={{ backgroundColor: Colors.ecoGreenBright, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 }}><Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>{selectedState}</Text></View>}
                    {selectedCity && <View style={{ backgroundColor: Colors.ecoGreenBright, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 }}><Text style={{ color: 'white', fontSize: 11, fontWeight: '600' }}>{selectedCity}</Text></View>}
                    <TouchableOpacity onPress={() => { setSelectedState(null); setSelectedCity(null); }} style={{ marginLeft: 'auto' }}>
                        <Text style={{ color: Colors.primary, fontSize: 12, fontWeight: '500' }}>Clear</Text>
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.leaderboardContent}>
                {loading ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={Colors.primary} /></View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <View style={styles.podiumContainer}>
                            {podiumOrder.map((item, displayIndex) => {
                                if (!item) return null;
                                const rank = displayIndex === 0 ? 2 : displayIndex === 1 ? 1 : 3;
                                const size = rank === 1 ? 80 : 64;
                                const rankStyle = rank === 1 ? styles.rankGold : rank === 2 ? styles.rankSilver : styles.rankBronze;
                                return (
                                    <View key={item.username} style={[styles.podiumItem, rank === 1 ? styles.podiumFirst : null]}>
                                        <View style={[styles.podiumAvatarWrapper, { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: 'transparent', overflow: 'hidden' }]}>
                                            <AvatarComposer head={item.head} hair={item.hair} accessory={item.accessory}
                                                headUrl={avatarParts.heads[item.head]?.url || 'https://via.placeholder.com/80?text=Head'}
                                                hairUrl={item.hair !== 'none' ? avatarParts.hairs[item.hair]?.url : null}
                                                accessoryUrl={item.accessory !== 'none' ? avatarParts.accessories[item.accessory]?.url : null}
                                                size={size} showLevel={false} points={item.points} />
                                        </View>
                                        <Text style={[styles.podiumRank, rankStyle]}>{rank}</Text>
                                        <Text style={styles.podiumPoints}>{item.points.toLocaleString()} pts</Text>
                                        <Text style={styles.podiumUsername} numberOfLines={1}>{item.username}</Text>
                                    </View>
                                );
                            })}
                        </View>
                        <FlatList
                            data={sortedPlayers.slice(3)}
                            renderItem={({ item, index }) => (
                                <View style={[styles.listRow, item.isYou ? styles.yourRow : null]}>
                                    <Text style={styles.listRank}>{index + 4}</Text>
                                    <View style={[styles.listAvatarWrapper, { width: 50, height: 50, overflow: 'hidden' }]}>
                                        <AvatarComposer head={item.head} hair={item.hair} accessory={item.accessory}
                                            headUrl={avatarParts.heads[item.head]?.url || 'https://via.placeholder.com/50?text=Head'}
                                            hairUrl={item.hair !== 'none' ? avatarParts.hairs[item.hair]?.url : null}
                                            accessoryUrl={item.accessory !== 'none' ? avatarParts.accessories[item.accessory]?.url : null}
                                            size={50} />
                                    </View>
                                    <Text style={styles.listUsername}>{item.username}</Text>
                                    <Text style={styles.listPoints}>{item.points.toLocaleString()} pts</Text>
                                </View>
                            )}
                            keyExtractor={(item, index) => `${item.username}-${index}`}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.listContent}
                        />
                    </View>
                )}
            </View>
        </AppLayoutWrapper>
    );
}

// ─── ARTICLES DATA — HARDCODED (ids 1-6) ─────────────────
const ARTICLES: Article[] = [
    {
        id: 1, title: 'The ABC of Used Cooking Oil',
        shortText: 'Learn what UCO is and why proper disposal matters for our environment.',
        image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=500&auto=format&fit=crop&q=80',
        points: 20,
        fullText: 'Used Cooking Oil (UCO) refers to oils and fats that have been used for cooking or frying in homes, restaurants, and food industries. Once used, these oils become contaminated with food particles and can no longer be used for cooking. However, UCO is a valuable resource when properly collected and recycled. Improper disposal—such as pouring it down the sink—can cause severe environmental damage, clog drainage systems, and contaminate water sources. By collecting UCO properly, we can transform waste into renewable energy like biodiesel, reducing our reliance on fossil fuels.',
        questions: [
            { question: 'What does UCO stand for?', options: ['A) Ultra Clean Oil', 'B) Used Cooking Oil', 'C) Universal Cooking Oil'], correctIndex: 1 },
            { question: 'What happens if you pour UCO down the sink?', options: ['A) It evaporates harmlessly', 'B) It helps clean the pipes', 'C) It can clog drainage and pollute water'], correctIndex: 2 },
            { question: 'What can recycled UCO be turned into?', options: ['A) Biodiesel and renewable energy', 'B) Only animal feed', 'C) Plastic bottles'], correctIndex: 0 },
        ],
    },
    {
        id: 2, title: 'How to Properly Dispose of UCO',
        shortText: 'Simple steps to collect and recycle used cooking oil at home.',
        image: 'https://images.unsplash.com/photo-1532634922-8fe0b757fb13?w=500&auto=format&fit=crop&q=80',
        points: 25,
        fullText: 'Proper disposal of used cooking oil is crucial for environmental protection. Never pour UCO down the sink or toilet—it solidifies in pipes and causes blockages. Instead, let the oil cool completely, then pour it into a sealed container like an empty plastic bottle or jar. Store it in a cool, dry place until you have enough to recycle. Use EcoMate\'s collection service to schedule a free pickup from your home. The oil will be professionally processed and converted into biodiesel, soap, or other useful products. Remember: one liter of improperly disposed UCO can contaminate up to one million liters of water!',
        questions: [
            { question: 'What\'s the first step in disposing UCO?', options: ['A) Pour it immediately while hot', 'B) Let it cool completely first', 'C) Mix it with water'], correctIndex: 1 },
            { question: 'How much water can 1 liter of UCO contaminate?', options: ['A) 1,000 liters', 'B) 100,000 liters', 'C) 1,000,000 liters'], correctIndex: 2 },
            { question: 'What should you use to store UCO?', options: ['A) Sealed plastic or glass containers', 'B) Paper bags', 'C) Open buckets'], correctIndex: 0 },
        ],
    },
    {
        id: 3, title: 'UCO to Biodiesel: The Process',
        shortText: 'Discover how used cooking oil becomes clean, renewable energy.',
        image: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=500&auto=format&fit=crop&q=80',
        points: 30,
        fullText: 'The transformation of used cooking oil into biodiesel is a fascinating process called transesterification. First, collected UCO is filtered to remove food particles and contaminants. Then, it\'s heated and mixed with alcohol (usually methanol) and a catalyst. This chemical reaction breaks down the oil\'s fat molecules into biodiesel and glycerin. The biodiesel is then purified, tested for quality, and can be used in any diesel engine without modifications. This renewable fuel reduces greenhouse gas emissions by up to 86% compared to petroleum diesel, making it one of the most sustainable fuels available today.',
        questions: [
            { question: 'What is the process of converting UCO to biodiesel called?', options: ['A) Transesterification', 'B) Hydrogenation', 'C) Distillation'], correctIndex: 0 },
            { question: 'By how much can biodiesel reduce emissions vs petroleum diesel?', options: ['A) 25%', 'B) 50%', 'C) 86%'], correctIndex: 2 },
            { question: 'Can biodiesel be used in regular diesel engines?', options: ['A) No, needs major modifications', 'B) Yes, without any modifications', 'C) Only in hybrid engines'], correctIndex: 1 },
        ],
    },
    {
        id: 4, title: 'Environmental Impact of UCO Recycling',
        shortText: 'See the positive effects of recycling cooking oil on our planet.',
        image: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=500&auto=format&fit=crop&q=80',
        points: 20,
        fullText: 'Recycling used cooking oil has tremendous environmental benefits. When UCO is properly collected and recycled, it prevents water pollution, reduces landfill waste, and creates renewable energy. Every ton of UCO converted to biodiesel saves approximately 3 tons of CO2 emissions. Additionally, biodiesel is biodegradable and non-toxic, making spills far less harmful than petroleum products. By participating in UCO recycling programs like EcoMate, you\'re directly contributing to a circular economy where waste becomes a valuable resource, protecting marine life, and combating climate change.',
        questions: [
            { question: 'How many tons of CO2 are saved per ton of UCO converted?', options: ['A) 1 ton', 'B) 5 tons', 'C) 3 tons'], correctIndex: 2 },
            { question: 'Is biodiesel biodegradable?', options: ['A) Yes, and it\'s non-toxic', 'B) No, it lasts forever', 'C) Only in saltwater'], correctIndex: 0 },
            { question: 'What type of economy does UCO recycling support?', options: ['A) Linear economy', 'B) Circular economy', 'C) Digital economy'], correctIndex: 1 },
        ],
    },
    {
        id: 5, title: 'UCO Collection at Home: Best Practices',
        shortText: 'Tips and tricks for collecting cooking oil safely and efficiently.',
        image: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=500&auto=format&fit=crop&q=80',
        points: 15,
        fullText: 'Setting up an efficient UCO collection system at home is simple and rewarding. Keep a dedicated container near your cooking area—a funnel makes pouring easier. Use containers with tight-fitting lids to prevent spills and odors. Label containers clearly to avoid confusion. If you deep-fry regularly, strain the oil after each use to extend its life before disposal. Never mix UCO with other liquids like water or cleaning products. Once your container is full, contact EcoMate for free pickup. Store multiple containers if needed, but ensure they\'re in a cool, dry place away from direct sunlight.',
        questions: [
            { question: 'Should you mix UCO with water before disposal?', options: ['A) Yes, it helps dilute it', 'B) Only if storing long-term', 'C) No, never mix it with other liquids'], correctIndex: 2 },
            { question: 'Where should you store UCO containers?', options: ['A) In direct sunlight', 'B) In a cool, dry place away from sunlight', 'C) In the freezer'], correctIndex: 1 },
            { question: 'Can you extend the life of cooking oil before disposal?', options: ['A) Yes, by straining it after each use', 'B) No, dispose after one use', 'C) Only by adding fresh oil'], correctIndex: 0 },
        ],
    },
    {
        id: 6, title: 'UCO in the Circular Economy',
        shortText: 'Understanding how waste oil becomes a valuable resource.',
        image: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=500&auto=format&fit=crop&q=80',
        points: 25,
        fullText: 'Used cooking oil is a perfect example of circular economy principles in action. Instead of being discarded as waste, UCO is collected, processed, and transformed into valuable products. Beyond biodiesel, UCO can be converted into soap, animal feed additives, industrial lubricants, and even cosmetics. This approach reduces waste, conserves resources, and creates economic opportunities. Companies worldwide are investing in UCO collection infrastructure, recognizing its potential to replace virgin oils and petroleum products. By participating in UCO recycling, you\'re supporting sustainable business models and helping build a more resilient, waste-free economy.',
        questions: [
            { question: 'What economic model does UCO recycling exemplify?', options: ['A) Gig economy', 'B) Circular economy', 'C) Traditional linear economy'], correctIndex: 1 },
            { question: 'Besides biodiesel, what else can UCO become?', options: ['A) Soap, animal feed, lubricants, and cosmetics', 'B) Only compost', 'C) Nothing useful'], correctIndex: 0 },
            { question: 'What does UCO help replace in manufacturing?', options: ['A) Only water', 'B) Electricity', 'C) Virgin oils and petroleum products'], correctIndex: 2 },
        ],
    },
];

// ─── LEARN SCREEN ─────────────────────────────────────────────────────────────
function LearnScreen({ navigation }: ScreenProps<'Learn'>) {
    const router = useRouter();
    const { userId } = useAuth();
    const eco = useEco();

    const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [selectedOption, setSelectedOption] = useState<number | null>(null);
    const [quizSubmitted, setQuizSubmitted] = useState(false);
    const [showResult, setShowResult] = useState(false);

    // ── CHANGE B: extra articles from Supabase + loading state ───────────────
    const [extraArticles, setExtraArticles] = useState<Article[]>([]);
    const [articlesLoading, setArticlesLoading] = useState(true);
    // ─────────────────────────────────────────────────────────────────────────

    const pendingQuizSave = useRef(false);

    useEffect(() => {
        if (!pendingQuizSave.current || !userId) return;
        pendingQuizSave.current = false;
        saveData(userId, eco);
    }, [eco.points, eco.completedQuizIds]);

    // ── CHANGE C: fetch Supabase articles on focus, deduplicate by id ────────
    useFocusEffect(useCallback(() => {
        let cancelled = false;
        const fetchExtras = async () => {
            setArticlesLoading(true);
            const extras = await getAdditionalArticles();
            if (!cancelled) {
                const hardcodedIds = new Set(ARTICLES.map(a => a.id));
                setExtraArticles(extras.filter(a => !hardcodedIds.has(a.id)));
                setArticlesLoading(false);
            }
        };
        fetchExtras();
        return () => { cancelled = true; };
    }, []));
    // ─────────────────────────────────────────────────────────────────────────

    const getToday = () => new Date().toISOString().slice(0, 10);

    const hasOpenedNewArticleToday = () =>
        eco.dailyOpenedDate === getToday() && eco.dailyOpenedArticleId !== null;

    const getAttemptsToday = (articleId: number): number => {
        const entry = eco.quizAttempts[articleId];
        if (!entry || entry.date !== getToday()) return 0;
        return entry.count;
    };

    // ── CHANGE D: allArticles = hardcoded + extras; sortedArticles uses allArticles
    const allArticles = useMemo(
        () => [...ARTICLES, ...extraArticles],
        [extraArticles]
    );

    const sortedArticles = useMemo(() => {
        const uncompleted = allArticles.filter(a => !eco.completedQuizIds.includes(a.id));
        const completed = allArticles.filter(a => eco.completedQuizIds.includes(a.id));
        return [...uncompleted, ...completed];
    }, [allArticles, eco.completedQuizIds]);
    // ─────────────────────────────────────────────────────────────────────────

    const viewArticle = (article: Article) => {
        const alreadyCompleted = eco.completedQuizIds.includes(article.id);
        const isTheTodayArticle =
            eco.dailyOpenedArticleId === article.id &&
            eco.dailyOpenedDate === getToday();

        if (!alreadyCompleted && !isTheTodayArticle) {
            if (hasOpenedNewArticleToday()) {
                Alert.alert(
                    'Daily Limit Reached',
                    "You've already opened your educational card for today.\nCome back tomorrow for a new one!"
                );
                return;
            }
            eco.setDailyOpened(article.id);
        }

        setSelectedArticle(article);
        setCurrentQuestion(null);
        setSelectedOption(null);
        setQuizSubmitted(false);
        setShowResult(false);
    };

    const startQuiz = (article: Article) => {
        const attemptsToday = getAttemptsToday(article.id);
        if (attemptsToday >= 3) {
            Alert.alert('No Attempts Left', "Come back tomorrow to try again!");
            return;
        }
        if (article.questions.length > 0) {
            setCurrentQuestion(article.questions[Math.floor(Math.random() * article.questions.length)]);
            setSelectedOption(null);
            setQuizSubmitted(false);
            setShowResult(false);
        } else {
            Alert.alert('No Questions', "This article doesn't have a quiz yet.");
        }
    };

    const handleSubmit = () => {
        if (selectedOption === null || !userId || !selectedArticle) return;
        setQuizSubmitted(true);
        setShowResult(true);
        const isCorrect = selectedOption === currentQuestion!.correctIndex;
        eco.recordQuizAttempt(selectedArticle.id);
        if (isCorrect) {
            if (!eco.completedQuizIds.includes(selectedArticle.id)) {
                pendingQuizSave.current = true;
                eco.completeQuiz(selectedArticle.id, selectedArticle.points);
                Alert.alert('Correct!', `+${selectedArticle.points} EcoPoints added!`);
            } else {
                Alert.alert('Correct!', 'Well done! (Already completed this quiz)');
            }
        } else {
            const attemptsUsed = getAttemptsToday(selectedArticle.id) + 1;
            const attemptsLeft = 3 - attemptsUsed;
            if (attemptsLeft > 0) {
                Alert.alert('Incorrect', `That's not right.\n${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} left today.`);
            } else {
                Alert.alert('No Attempts Left', "You've used all 3 attempts.\nCome back tomorrow to try again!");
            }
        }
    };

    const renderArticleCard = ({ item }: { item: Article }) => {
        const isCompleted = eco.completedQuizIds.includes(item.id);
        const isOpenedToday =
            eco.dailyOpenedArticleId === item.id &&
            eco.dailyOpenedDate === getToday() &&
            !isCompleted;

        return (
            <TouchableOpacity
                style={[
                    styles.articleCard,
                    isCompleted ? styles.articleCardCompleted : null,
                    isOpenedToday ? styles.articleCardOpenedToday : null,
                ]}
                onPress={() => viewArticle(item)}
            >
                <Image source={{ uri: item.image }} style={styles.articleImage} contentFit="cover" />
                <View style={styles.articleInfo}>
                    <Text style={styles.articleTitle}>{item.title}</Text>
                    <Text style={styles.articleShortText}>{item.shortText}</Text>
                    <View style={styles.pointsBadge}>
                        <Text style={styles.pointsTextBadge}>+{item.points} pts</Text>
                    </View>
                    {isCompleted && (
                        <Text style={styles.completedBadge}>Completed</Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <AppLayoutWrapper showTopDecor={false} useGreenHeader={false}>
            <View style={styles.pageHeaderRow}>
                <BackButton style={styles.backIconBtn} />
                <AppText variant="header" style={styles.pageHeaderTitle}>Learn & Earn</AppText>
                <Pressable onPress={() => router.push('/(main)/(user)/userHome')} hitSlop={12} style={styles.homeBtn}>
                    <Ionicons name="home-sharp" size={24} color={Colors.primary} />
                </Pressable>
            </View>
            <View style={styles.educationContent}>
                {!selectedArticle ? (
                    // ── CHANGE D (part 2): loading guard around FlatList ──────
                    articlesLoading ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={Colors.primary} />
                        </View>
                    ) : (
                        <FlatList
                            data={sortedArticles}
                            renderItem={renderArticleCard}
                            keyExtractor={item => item.id.toString()}
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={styles.contentContainer}
                        />
                    )
                    // ─────────────────────────────────────────────────────────
                ) : (
                    <ScrollView contentContainerStyle={styles.articleDetailContainer}>
                        <Image source={{ uri: selectedArticle.image }} style={styles.fullArticleImage} contentFit="cover" />
                        <Text style={styles.articleDetailTitle}>{selectedArticle.title}</Text>
                        <Text style={styles.articleDetailText}>{selectedArticle.fullText}</Text>
                        {(() => {
                            const isCompleted = eco.completedQuizIds.includes(selectedArticle.id);
                            const attemptsToday = getAttemptsToday(selectedArticle.id);
                            const noAttemptsLeft = attemptsToday >= 3;
                            const label = isCompleted
                                ? 'Already Completed'
                                : noAttemptsLeft
                                    ? 'Come Back Tomorrow'
                                    : `TAKE QUIZ (${3 - attemptsToday} attempt${3 - attemptsToday === 1 ? '' : 's'} left)`;
                            return (
                                <AppButton
                                    title={label}
                                    onPress={() => startQuiz(selectedArticle)}
                                    variant="role"
                                    disabled={isCompleted || noAttemptsLeft}
                                    fullWidth style={styles.quizActionBtn}
                                />
                            );
                        })()}
                        {currentQuestion && (
                            <View style={styles.quizContainer}>
                                <Text style={styles.quizQuestion}>{currentQuestion.question}</Text>
                                {currentQuestion.options.map((opt, index) => (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.quizOption,
                                            selectedOption === index ? styles.selectedOption : null,
                                            quizSubmitted && index === currentQuestion.correctIndex ? styles.correctOption : null,
                                            quizSubmitted && selectedOption === index && index !== currentQuestion.correctIndex ? styles.wrongOption : null,
                                        ]}
                                        onPress={() => !quizSubmitted && setSelectedOption(index)}
                                        disabled={quizSubmitted}
                                    >
                                        <Text style={styles.quizOptionText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))}
                                {!quizSubmitted && selectedOption !== null && (
                                    <AppButton title="Submit Answer" onPress={handleSubmit} variant="pill" fullWidth style={styles.quizActionBtn} />
                                )}
                                {showResult && (
                                    <Text style={[styles.resultText, selectedOption === currentQuestion.correctIndex ? styles.correctResult : styles.wrongResult]}>
                                        {selectedOption === currentQuestion.correctIndex
                                            ? `Correct! +${selectedArticle.points} pts`
                                            : `Incorrect – correct answer: ${currentQuestion.options[currentQuestion.correctIndex]}`}
                                    </Text>
                                )}
                            </View>
                        )}
                        <AppButton title="← Back to Articles" onPress={() => { setSelectedArticle(null); setCurrentQuestion(null); }} variant="outline" fullWidth style={styles.backBtn} />
                    </ScrollView>
                )}
            </View>
        </AppLayoutWrapper>
    );
}

// ─── NAVIGATION STACK ─────────────────────────────────────────────────────────
const Stack = createNativeStackNavigator<RootStackParamList>();

function AppInner() {
    const { userId, loading: authLoading } = useAuth();
    const [appReady, setAppReady] = useState(false);
    const realtimeChannelRef = useRef<any>(null);
    const eco = useEco();
    const ecoPointsRef = useRef(eco.points);

    useEffect(() => { ecoPointsRef.current = eco.points; }, [eco.points]);

    useEffect(() => {
        if (!userId) return;
        setAppReady(false);
        shownBadgeAlerts.clear();
        eco.reset();
        loadData(userId, eco.hydrate, eco.setCollectionsMade).then(() => setAppReady(true));
    }, [userId]);

    useEffect(() => {
        if (!userId) return;
        if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
        const channel = supabase
            .channel(`points-changes-${userId}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `user_id=eq.${userId}` },
                (payload) => {
                    if (!payload.new || typeof payload.new.points !== 'number') return;
                    const gained = payload.new.points - ecoPointsRef.current;
                    if (gained > 0) {
                        eco.addPoints(gained);
                        Alert.alert(' EcoPoints Awarded!', `+${gained} points for your recent collection!\nNew total: ${payload.new.points}`, [{ text: 'Awesome!' }]);
                    }
                }
            ).subscribe();
        realtimeChannelRef.current = channel;
        return () => { supabase.removeChannel(channel); };
    }, [userId]);

    if (authLoading || !appReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.primary }}>
                <ActivityIndicator size="large" color="#fff" />
                <Text style={{ color: '#fff', marginTop: 20, fontSize: 18, fontWeight: '600' }}>Setting up your account...</Text>
            </View>
        );
    }

    return (
        <Stack.Navigator initialRouteName="Profile">
            <Stack.Screen name="Profile" component={MyProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Avatar" component={AvatarScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Achievements" component={AchievementsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Learn" component={LearnScreen} options={{ headerShown: false }} />
        </Stack.Navigator>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <EcoProvider>
                <AppInner />
            </EcoProvider>
        </AuthProvider>
    );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    safeArea: { flex: 1 },
    decorativeTop: { height: 40 },
    roundedContent: { flex: 1, backgroundColor: Colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, overflow: 'hidden', marginTop: -24 },
    container: { flex: 1, backgroundColor: Colors.background },
    twoButtonRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 8, marginBottom: 16, paddingHorizontal: 4, paddingBottom: 8 },
    halfBtn: { flex: 1, alignSelf: 'stretch', maxWidth: 9999, width: undefined as any },
    mockRecycleBtn: { height: 40, maxWidth: 200, paddingHorizontal: 14 },
    avatarContent: { flex: 1, paddingHorizontal: 4 },
    avatarCenterContainer: { alignItems: 'center', marginVertical: 4, backgroundColor: 'transparent' },
    avatarPreviewCircle: { width: 240, height: 240, borderRadius: 120, overflow: 'hidden', backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
    pointsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 12, paddingHorizontal: 4 },
    pointsText: { fontSize: 17, fontWeight: '700', color: Colors.ecoGreenDark },
    tabBar: { backgroundColor: Colors.primary },
    gridContainer: { paddingBottom: 40 },
    item: { padding: 12, marginBottom: 12, borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 16, alignItems: 'center', backgroundColor: '#fff', elevation: 3 },
    selected: { borderColor: Colors.primary, borderWidth: 2.5, backgroundColor: '#f0fdf4' },
    previewMini: { width: 60, height: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
    itemText: { fontSize: 14, textAlign: 'center', color: '#374151' },
    lockText: { color: '#ef4444', fontSize: 12, marginTop: 4 },
    locked: { opacity: 0.6 },
    profileHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 0, paddingBottom: 6 },
    profileHeaderTitle: { flex: 1, textAlign: 'center', color: Colors.primary, marginBottom: 0 },
    homeBtn: { width: 44, alignItems: 'flex-end', justifyContent: 'center' },
    pageHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 0, paddingBottom: 6, backgroundColor: Colors.background, zIndex: 1 },
    pageHeaderTitle: { flex: 1, textAlign: 'center', color: Colors.primary, marginBottom: 0 },
    backIconBtn: { width: 44, alignItems: 'flex-start', justifyContent: 'center' },
    profileContainer: { flex: 1 },
    avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
    avatarCircle: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
    profileName: { fontSize: 24, fontWeight: 'bold', color: Colors.primary, marginBottom: 12 },
    statsRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 4 },
    statMini: { alignItems: 'center' },
    statMiniNumber: { fontSize: 20, fontWeight: 'bold', color: Colors.ecoGreenDark },
    statMiniLabel: { fontSize: 12, color: Colors.mutedText, marginTop: 2 },
    progressCard: { backgroundColor: Colors.white, marginHorizontal: 20, marginBottom: 16, padding: 18, borderRadius: 16, elevation: 2 },
    progressRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    progressLabel: { fontSize: 13, fontWeight: '600', color: Colors.ecoGreenDark },
    progressOuter: { width: '100%', height: 12, backgroundColor: '#d7e5dd', borderRadius: 6, overflow: 'hidden' },
    progressInner: { height: '100%', backgroundColor: Colors.primary, borderRadius: 6 },
    progressText: { fontSize: 12, color: Colors.mutedText, marginTop: 6, textAlign: 'center' },
    userInfoCard: { backgroundColor: Colors.white, marginHorizontal: 20, marginBottom: 16, padding: 20, borderRadius: 16, elevation: 2 },
    infoCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    userInfoTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.primary },
    editChipBtn: { height: 34, maxWidth: 90, paddingHorizontal: 14, borderRadius: 20 },
    cityFilterBtn: { height: 34, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: Colors.primary, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    cityFilterBtnDisabled: { borderColor: '#bdbdbd', backgroundColor: '#f5f5f5', opacity: 0.6 },
    cityFilterBtnText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
    cityFilterBtnTextDisabled: { color: '#9e9e9e' },
    userInfoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'flex-start' },
    userInfoLabel: { fontSize: 13, color: Colors.mutedText, fontWeight: '600', width: '32%' },
    userInfoValue: { fontSize: 13, color: Colors.text, flex: 1, textAlign: 'right' },
    addressInput: { marginTop: 14, minHeight: 90 },
    statsGrid: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 24, gap: 10, minHeight: 120 },
    statBox: { flex: 1, backgroundColor: Colors.white, paddingVertical: 24, paddingHorizontal: 8, borderRadius: 16, elevation: 3, alignItems: 'center', justifyContent: 'center', minWidth: 0, minHeight: 120 },
    statNumber: { fontSize: 22, fontWeight: '600', color: Colors.primary, textAlign: 'center' },
    statLabel: { fontSize: 13, color: Colors.mutedText, textAlign: 'center', marginTop: 6, lineHeight: 18 },
    tilesSection: { paddingHorizontal: 20, marginBottom: 40 },
    achievementsContainer: { flex: 1, paddingHorizontal: 16, paddingTop: 8 },
    badgeGrid: { paddingBottom: 40 },
    badgeCard: { flex: 1, margin: 8, backgroundColor: Colors.white, borderRadius: 20, paddingVertical: 16, paddingHorizontal: 12, alignItems: 'center', elevation: 4, minHeight: 170 },
    badgeIconContainer: { width: 90, height: 90, justifyContent: 'center', alignItems: 'center', marginBottom: 12, backgroundColor: '#f1f5f9', borderRadius: 20, overflow: 'hidden' },
    badgeSvgLocked: { opacity: 0.55 },
    badgeTitle: { fontSize: 14, fontWeight: '600', color: '#111827', textAlign: 'center', marginBottom: 6, lineHeight: 18 },
    badgeUnlocked: { fontSize: 12, color: '#10b981', fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalCard: { backgroundColor: Colors.white, borderRadius: 28, padding: 32, width: '88%', maxWidth: 380, alignItems: 'center', elevation: 12 },
    modalTitle: { fontSize: 24, fontWeight: '700', color: '#111827', marginBottom: 14, textAlign: 'center' },
    modalReason: { fontSize: 15, color: '#4b5563', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    leaderboardContent: { flex: 1 },
    podiumContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: 4, marginBottom: 8, paddingHorizontal: 8 },
    podiumItem: { alignItems: 'center', marginHorizontal: 8, flex: 1 },
    podiumFirst: { marginBottom: 16 },
    podiumAvatarWrapper: { overflow: 'hidden', borderWidth: 4, borderColor: Colors.white, backgroundColor: Colors.white, elevation: 10 },
    podiumRank: { fontSize: 28, fontWeight: '900', marginTop: 4 },
    podiumPoints: { fontSize: 12, fontWeight: 'bold', color: Colors.ecoGreenDark, marginTop: 1 },
    podiumUsername: { fontSize: 11, color: Colors.mutedText, marginTop: 1, textAlign: 'center', maxWidth: 90 },
    rankGold: { color: '#FFD700' },
    rankSilver: { color: '#A0A0A0' },
    rankBronze: { color: '#CD7F32' },
    listContent: { paddingBottom: 30 },
    listRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 12, marginVertical: 5, borderRadius: 14, elevation: 2 },
    yourRow: { backgroundColor: '#e8f5e9', borderWidth: 2, borderColor: Colors.primary },
    listRank: { fontSize: 18, fontWeight: 'bold', width: 36, textAlign: 'center', color: Colors.primary },
    listAvatarWrapper: { marginHorizontal: 10 },
    listUsername: { flex: 1, fontSize: 14, fontWeight: '500', color: Colors.text },
    listPoints: { fontSize: 14, fontWeight: '600', color: Colors.primary },
    educationScreen: { flex: 1, backgroundColor: Colors.background },
    educationContent: { flex: 1 },
    contentContainer: { paddingHorizontal: 16, paddingBottom: 20, paddingTop: 0 },
    articleCard: { backgroundColor: Colors.white, borderRadius: 16, marginVertical: 8, overflow: 'hidden', elevation: 4 },
    articleCardCompleted: { borderColor: '#10b981', borderWidth: 2 },
    articleCardOpenedToday: { borderColor: Colors.ecoGreenBright, borderWidth: 2 },
    articleImage: { width: '100%', height: 140 },
    articleInfo: { padding: 16 },
    articleTitle: { fontSize: 17, fontWeight: 'bold', color: Colors.primary, marginBottom: 6 },
    articleShortText: { fontSize: 13, color: Colors.mutedText, marginBottom: 12 },
    pointsBadge: { backgroundColor: Colors.primary, alignSelf: 'flex-start', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20 },
    pointsTextBadge: { color: 'white', fontWeight: 'bold', fontSize: 13 },
    completedBadge: { color: '#10b981', fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center', backgroundColor: '#d1fae5', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, alignSelf: 'center' },
    openedTodayBadge: { color: Colors.ecoGreenBright, fontSize: 13, fontWeight: '600', marginTop: 8, textAlign: 'center', backgroundColor: '#e6f9f1', paddingVertical: 4, paddingHorizontal: 12, borderRadius: 12, alignSelf: 'center' },
    articleDetailContainer: { padding: 16 },
    fullArticleImage: { width: '100%', height: 200, borderRadius: 16, marginBottom: 16 },
    articleDetailTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.primary, marginBottom: 12, textAlign: 'center' },
    articleDetailText: { fontSize: 15, color: Colors.text, lineHeight: 24, marginBottom: 24, textAlign: 'justify' },
    quizActionBtn: { marginTop: 16, marginBottom: 4 },
    quizContainer: { backgroundColor: Colors.white, borderRadius: 16, padding: 20, marginTop: 16, elevation: 3 },
    quizQuestion: { fontSize: 17, fontWeight: '600', color: Colors.primary, marginBottom: 18 },
    quizOption: { backgroundColor: '#f9fafb', padding: 14, borderRadius: 12, marginVertical: 6, borderWidth: 1, borderColor: '#e5e7eb' },
    selectedOption: { borderColor: Colors.primary, borderWidth: 2, backgroundColor: '#f0fdf4' },
    correctOption: { backgroundColor: '#d1fae5', borderColor: '#10b981', borderWidth: 2 },
    wrongOption: { backgroundColor: '#fee2e2', borderColor: '#ef4444', borderWidth: 2 },
    quizOptionText: { fontSize: 15, color: '#1f2937' },
    resultText: { fontSize: 17, fontWeight: 'bold', marginTop: 18, textAlign: 'center' },
    correctResult: { color: '#10b981' },
    wrongResult: { color: '#ef4444' },
    backBtn: { marginTop: 28, marginBottom: 40 },
});