import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import Colors from "../constants/colors";

type ButtonVariant = "role" | "pill" | "outline";

type Props = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
};

export default function AppButton({
  title,
  onPress,
  variant = "role",
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
}: Props) {
  const rippleColor =
    variant === "outline"
      ? "rgba(46,125,50,0.18)"
      : "rgba(255,255,255,0.18)";

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      android_ripple={{ color: rippleColor }}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,

        // variants
        variant === "role" && styles.roleBtn,
        variant === "pill" && styles.pillBtn,
        variant === "outline" && styles.outlineBtn,

        // width behavior
        fullWidth && styles.fullWidth,

        // states
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,

        // optional override
        style,
      ]}
    >
      <Text
        style={[
          styles.textBase,
          variant === "role" && styles.roleText,
          variant === "pill" && styles.pillText,
          variant === "outline" && styles.outlineText,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // 🔒 GLOBAL GUARANTEE: always centered
  base: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    overflow: "hidden",
  },

  // full-width override (still centered in layout)
  fullWidth: {
    width: "100%",
  },

  roleBtn: {
    height: 52,
    width: "90%",
    maxWidth: 330,
    borderRadius: 6,
    backgroundColor: Colors.roleButton,
  },

  roleText: {
    color: "white",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },

  pillBtn: {
    height: 50,
    width: "90%",
    maxWidth: 300,
    borderRadius: 999,
    backgroundColor: Colors.pillButton,
    borderWidth: 2,
    borderColor: Colors.pillBorder,
  },

  pillText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.6,
  },

  outlineBtn: {
    height: 48,
    width: "90%",
    maxWidth: 280,
    borderRadius: 14,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.primary,
  },

  outlineText: {
    color: Colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },

  pressed: { opacity: 0.9 },
  disabled: { opacity: 0.55 },

  textBase: {
    textAlign: "center",
  },
});
