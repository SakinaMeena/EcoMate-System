import React from "react";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Colors from "../constants/colors";

type Props = {
  to?: string;                 
  style?: ViewStyle;          
};

export default function BackButton({ to, style }: Props) {
  const router = useRouter();

  const handlePress = () => {
    if (to) {
     
      router.replace(to);
    } else if (router.canGoBack()) {
      
      router.back();
    } else {
      
      router.replace("/");
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      hitSlop={10}
      style={[styles.button, style]}
    >
      <Ionicons name="chevron-back" size={22} color={Colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(46,125,50,0.12)",
  },
});