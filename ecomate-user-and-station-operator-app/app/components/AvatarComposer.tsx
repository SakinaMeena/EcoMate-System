import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';

// ──────────────────────────────────────────────
// Per-hair transform tuning (UNCHANGED)
// ──────────────────────────────────────────────
type LayerTransform = { scale: number; translateY: number; translateX: number };

const hairTransforms: Record<string, LayerTransform> = {
    bob: { scale: 1.05, translateY: -0.08, translateX: 0.00 },
    curlyBob: { scale: 1.28, translateY: 0.030, translateX: 0.00 },
    curvyBob: { scale: 1.79, translateY: -0.065, translateX: 0.00 },
    pixie: { scale: 1.70, translateY: -0.08, translateX: 0.039 },
    caesar: { scale: 0.80, translateY: -0.28, translateX: -0.03 },
    mowgli: { scale: 1.80, translateY: -0.05, translateX: 0.01 },
    straightCurvy: { scale: 1.29, translateY: 0.005, translateX: 0.02 },
};

// ──────────────────────────────────────────────
// Per-accessory transform tuning (UNCHANGED)
// ──────────────────────────────────────────────
const accessoryTransforms: Record<string, LayerTransform> = {
    glasses: { scale: 1.01, translateY: -0.10, translateX: 0.00 },
    hat: { scale: 1.00, translateY: -0.25, translateX: 0.00 },
    hijab: { scale: 1.00, translateY: 0.03, translateX: 0.01 },
    sunglasses: { scale: 1.00, translateY: -0.10, translateX: 0.00 },
    turban: { scale: 1.00, translateY: -0.23, translateX: 0.00 },
};

const DEFAULT_TRANSFORM: LayerTransform = { scale: 1.0, translateY: 0.0, translateX: 0.0 };

// ──────────────────────────────────────────────
// Props (now expects URLs from Supabase)
// ──────────────────────────────────────────────
interface AvatarComposerProps {
    head: string;           // e.g. 'light'
    hair: string;           // e.g. 'bob' or 'none'
    accessory: string;      // e.g. 'glasses' or 'none'
    headUrl: string;        // Supabase URL for head (required)
    hairUrl?: string | null;      // Supabase URL or null for 'none'
    accessoryUrl?: string | null; // Supabase URL or null for 'none'
    size?: number;
    points?: number;
    showLevel?: boolean;
}

// ──────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────
const AvatarComposer: React.FC<AvatarComposerProps> = ({
    head = 'light',
    hair = 'none',
    accessory = 'none',
    headUrl,
    hairUrl = null,
    accessoryUrl = null,
    size = 200,
    points = 0,
    showLevel = false,
}) => {
    const headSource = { uri: headUrl };
    const hairSource = hairUrl ? { uri: hairUrl } : null;
    const accessorySource = accessoryUrl ? { uri: accessoryUrl } : null;

    const hairT = hairTransforms[hair] ?? DEFAULT_TRANSFORM;
    const accT = accessoryTransforms[accessory] ?? DEFAULT_TRANSFORM;

    const level = Math.floor(points / 500) + 1;
    const badgeSize = size * 0.35;
    const badgeFontSize = size * 0.07;

    const absoluteFill = {
        position: 'absolute' as const,
        top: 0,
        left: 0,
        width: size,
        height: size,
    };

    return (
        <View style={[styles.container, { width: size, height: size }]}>
            {/* Head */}
            <Image
                source={headSource}
                style={absoluteFill}
                contentFit="contain"
                cachePolicy="memory-disk"
            />

            {/* Hair */}
            {hairSource && (
                <Image
                    source={hairSource}
                    style={[
                        absoluteFill,
                        {
                            transform: [
                                { scale: hairT.scale },
                                { translateY: size * hairT.translateY },
                                { translateX: size * hairT.translateX },
                            ],
                        },
                    ]}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                />
            )}

            {/* Accessory */}
            {accessorySource && (
                <Image
                    source={accessorySource}
                    style={[
                        absoluteFill,
                        {
                            transform: [
                                { scale: accT.scale },
                                { translateY: size * accT.translateY },
                                { translateX: size * accT.translateX },
                            ],
                        },
                    ]}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                />
            )}

            {/* Level badge */}
            {showLevel && level > 0 && (
                <View
                    style={[
                        styles.levelBadgeContainer,
                        {
                            width: badgeSize,
                            height: badgeSize,
                            borderRadius: badgeSize / 2,
                            bottom: size * 0.06,
                            right: size * 0.06,
                        },
                    ]}
                >
                    <Text style={[styles.levelBadgeText, { fontSize: badgeFontSize }]}>
                        Lvl {level}
                    </Text>
                </View>
            )}
        </View>
    );
};

// Styles (unchanged)
const styles = StyleSheet.create({
    container: {
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 20,
        overflow: 'hidden',
    },
    levelBadgeContainer: {
        position: 'absolute',
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#ffffff',
        elevation: 3,
    },
    levelBadgeText: {
        color: '#ffffff',
        fontWeight: 'bold',
    },
});

export default AvatarComposer;