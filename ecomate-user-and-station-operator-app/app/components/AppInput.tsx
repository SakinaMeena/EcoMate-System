import React, { useState } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Pressable,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Colors from "../constants/colors";

type Props = TextInputProps & {
  label?: string;

  error?: string;

  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: StyleProp<ViewStyle>;

  
  helperText?: string;
};

export default function AppInput({
  label,
  secureTextEntry = false,
  error,
  icon,
  style,
  containerStyle,
  helperText,
  ...props
}: Props) {
  const [hidePassword, setHidePassword] = useState(!!secureTextEntry);

  const isEditable = props.editable !== false;
  const hasError = !!(error && error.trim().length > 0);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <View
        style={[
          styles.inputContainer,
          !isEditable && styles.disabled,
          hasError && styles.inputError,
        ]}
      >
        {icon ? (
          <Ionicons
            name={icon}
            size={20}
            color={hasError ? Colors.error : Colors.mutedText}
            style={styles.leftIcon}
          />
        ) : null}

        <TextInput
          {...props}
          style={[styles.input, style]}
          editable={isEditable}
          placeholderTextColor={Colors.mutedText}
          secureTextEntry={secureTextEntry ? hidePassword : false}
          selectionColor={Colors.primary}
          autoCorrect={props.autoCorrect ?? false}
          autoCapitalize={props.autoCapitalize ?? "none"}
          accessibilityLabel={label ?? props.placeholder ?? "Input field"}
        />

        {secureTextEntry && isEditable ? (
          <Pressable
            onPress={() => setHidePassword((prev) => !prev)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={hidePassword ? "Show password" : "Hide password"}
          >
            <Ionicons
              name={hidePassword ? "eye-off" : "eye"}
              size={20}
              color={hasError ? Colors.error : Colors.mutedText}
            />
          </Pressable>
        ) : null}
      </View>

     
      {hasError ? (
        <Text style={styles.error}>{error}</Text>
      ) : helperText ? (
        <Text style={styles.helper}>{helperText}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: "100%",
    marginTop: 14,
  },
  label: {
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "700",
    color: Colors.text,
  },
  inputContainer: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    backgroundColor: Colors.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
  },
  disabled: {
    opacity: 0.7,
  },
  leftIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
  },
  inputError: {
    borderColor: Colors.error,
  },
  error: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.error,
    fontWeight: "600",
  },
  helper: {
    marginTop: 6,
    fontSize: 12,
    color: Colors.mutedText,
    fontWeight: "500",
  },
});
