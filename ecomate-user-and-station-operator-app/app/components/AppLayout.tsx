import React from "react";
import { View, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Colors from "../constants/colors";

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export default function AppLayout({ children, style }: Props) {
  return (
    <SafeAreaView
      style={styles.safe}
      edges={["top", "left", "right"]}
    >
      
      <View pointerEvents="none" style={styles.top} />

      
      <View style={[styles.body, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.primary,
  },

  top: {
    height: 40,
    backgroundColor: Colors.primary,
  },

  body: {
    flex: 1,
    backgroundColor: Colors.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: "hidden",

    paddingHorizontal: 24,
    paddingTop: 15,
  },
});
