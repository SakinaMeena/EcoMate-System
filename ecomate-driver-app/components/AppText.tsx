import React from "react";
import { Text, TextProps, StyleSheet, TextStyle, StyleProp } from "react-native";
import Colors from "../constants/colors";

type TextVariant =
  | "appTitle"
  | "header"
  | "sectionTitle"
  | "body"
  | "caption"
  | "button"
  | "error";   

type Props = TextProps & {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export default function AppText({
  variant = "body",
  color,
  style,
  children,
  ...props
}: Props) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        styles[variant],
        color ? { color } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: Colors.text,
  },

  appTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.primary,
    letterSpacing: 1,
  },

  header: {
    fontSize: 20,
    fontWeight: "900",
    color: Colors.ecoGreenDark,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },

  body: {
    fontSize: 14,
    lineHeight: 20,
  },

  caption: {
    fontSize: 12,
    color: Colors.mutedText,
  },

  button: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "white",
  },

  error: {
    fontSize: 12,
    color: Colors.error,  
    marginTop: 4,
  },
});
