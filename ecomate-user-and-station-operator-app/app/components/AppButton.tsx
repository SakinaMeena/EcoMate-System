import React from "react";
import { Pressable, Text, StyleSheet, ViewStyle, TextStyle } from "react-native";
import Colors from "../constants/colors";

type ButtonVariant =
  | "role"
  | "pill"
  | "outline"
  | "edit"
  | "save"
  | "cancel"
  | "primary" 
  | "secondary"; 

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
    variant === "outline" || variant === "edit"
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

        
        variant === "role" && styles.roleBtn,
        variant === "pill" && styles.pillBtn,
        variant === "outline" && styles.outlineBtn,
        variant === "edit" && styles.editBtn,
        variant === "save" && styles.saveBtn,
        variant === "cancel" && styles.cancelBtn,
        variant === "primary" && styles.primaryBtn,
        variant === "secondary" && styles.secondaryBtn,

        fullWidth && styles.fullWidth,
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,

        style,
      ]}
    >
      <Text
        style={[
          styles.textBase,

          variant === "role" && styles.roleText,
          variant === "pill" && styles.pillText,
          variant === "outline" && styles.outlineText,
          variant === "edit" && styles.editText,
          variant === "save" && styles.saveText,
          variant === "cancel" && styles.cancelText,
          variant === "primary" && styles.primaryText,
          variant === "secondary" && styles.secondaryText,

          textStyle,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 12,
    overflow: "hidden",
  },

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
    maxWidth: 250,
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

  editBtn: {
    height: 40,
    borderRadius: 20,
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: Colors.primary,
    paddingHorizontal: 20,
  },

  editText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 14,
  },

  saveBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },

  saveText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },

  cancelBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: "#EDEFF2",
  },

  cancelText: {
    color: Colors.text,
    fontWeight: "600",
    fontSize: 15,
  },

  primaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },

  primaryText: {
    color: "white",
    fontWeight: "700",
    fontSize: 15,
  },

  secondaryBtn: {
    height: 50,
    borderRadius: 16,
    backgroundColor: (Colors as any).secondary ?? "#E6F4EA",
  },

  secondaryText: {
    color: Colors.primary,
    fontWeight: "700",
    fontSize: 15,
  },

  pressed: {
    opacity: 0.9,
  },

  disabled: {
    opacity: 0.55,
  },

  textBase: {
    textAlign: "center",
  },
});