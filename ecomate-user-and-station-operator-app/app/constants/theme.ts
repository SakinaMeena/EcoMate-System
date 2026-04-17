// constants/theme.ts
import { MD3LightTheme } from "react-native-paper";
import Colors from "./colors";

export const theme = {
  ...MD3LightTheme,
  roundness: 12,

  colors: {
    ...MD3LightTheme.colors,

    primary: Colors.primary,
    onPrimary: "#FFFFFF",

    secondary: Colors.secondary,
    onSecondary: "#FFFFFF",

    background: Colors.background,
    surface: "#FFFFFF",
    surfaceVariant: Colors.inputBg,

    onBackground: Colors.text,
    onSurface: Colors.text,

    outline: Colors.inputBorder,
    outlineVariant: Colors.inputBorder,

    error: Colors.error,
  },
};
