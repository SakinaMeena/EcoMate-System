import { Stack } from "expo-router";
import AppLayout from "../components/AppLayout";

export default function MainLayout() {
  return (
    <AppLayout>
      <Stack screenOptions={{ headerShown: false }} />
    </AppLayout>
  );
}
