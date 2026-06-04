import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerTintColor: "#0b6", headerTitleStyle: { color: "#1a1a1a" } }}>
        <Stack.Screen name="index" options={{ title: "bizfinder.ie" }} />
        <Stack.Screen name="business/[slug]" options={{ title: "" }} />
      </Stack>
    </>
  );
}
