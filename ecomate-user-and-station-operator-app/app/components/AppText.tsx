import React from "react";
import {
  Text,
  TextProps,
  StyleSheet,
  TextStyle,
  StyleProp,
} from "react-native";
import Colors from "../constants/colors";

type TextVariant =
  | "appTitle"
  | "header"
  | "title"
  | "sectionTitle"
  | "body"
  | "caption"
  | "button"
  | "error"
  | "nameTag"
  | "formLabel";

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
    color: Colors.primary,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  title: {
    fontSize: 18,
    fontWeight: "900",
    color: Colors.primary,
    letterSpacing: 0.5,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
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

  nameTag: {
    fontSize: 22,
    fontWeight: "900",
    color: Colors.ecoGreenDark,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignSelf: "center",
  },

  formLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
  },
});