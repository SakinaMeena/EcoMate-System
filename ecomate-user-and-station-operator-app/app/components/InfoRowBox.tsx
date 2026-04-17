import React from "react";
import { View, StyleSheet, Pressable, StyleProp, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import AppText from "./AppText";
import Colors from "../constants/colors";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  rightText?: string;             
  onRightPress?: () => void;       
  containerStyle?: StyleProp<ViewStyle>;
  numberOfLines?: number;          
};

export default function InfoRowBox({
  icon,
  text,
  rightText,
  onRightPress,
  containerStyle,
  numberOfLines = 2,
}: Props) {
  const Right = rightText ? (
    <Pressable
      onPress={onRightPress}
      disabled={!onRightPress}
      style={({ pressed }) => [styles.rightBtn, pressed && styles.pressed]}
      hitSlop={10}
    >
      <Ionicons name="pencil" size={16} color={Colors.primary} />
      <AppText style={styles.rightText}>{rightText}</AppText>
    </Pressable>
  ) : (
    <View style={styles.rightSpacer} />
  );

  return (
    <View style={[styles.row, containerStyle]}>
      
      <View style={styles.leftIconWrap}>
        <Ionicons name={icon} size={18} color={Colors.primary} />
      </View>

      <View style={styles.mid}>
        <AppText style={styles.midText} numberOfLines={numberOfLines}>
          {text}
        </AppText>
      </View>

      {Right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E7F3EC",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
  },

  leftIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "#D6EADF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  mid: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },

  midText: {
    fontSize: 12.5,
    color: Colors.text,
    lineHeight: 16,
    fontWeight: "600",
  },

  rightBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
  },

  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },

  rightText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },

  rightSpacer: {
    width: 1,
  },
});
