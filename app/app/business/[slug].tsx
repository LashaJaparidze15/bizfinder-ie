import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet, Linking, ScrollView, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { BusinessListing } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { BizPhoto } from "@/components/BizPhoto";

export default function BusinessScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [b, setB] = useState<BusinessListing | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api
      .getBusiness(slug)
      .then((data) => {
        if (!active) return;
        setB(data);
        track(data.id, "impression");
      })
      .catch(() => active && setB(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [slug]);

  // dwell: fire elapsed time when leaving the screen
  useEffect(() => {
    const start = Date.now();
    return () => {
      if (b) track(b.id, "dwell", { dwellMs: Date.now() - start });
    };
  }, [b]);

  if (loading) return <ActivityIndicator style={{ marginTop: 40 }} />;
  if (!b) return <Text style={styles.muted}>Business not found.</Text>;

  const where = [b.location?.addressLine, b.location?.town, b.location?.county, b.location?.eircode]
    .filter(Boolean)
    .join(", ");

  function call(e164: string) {
    if (!b) return;
    track(b.id, "call"); // the metric businesses pay for
    Linking.openURL(`tel:${e164}`);
  }

  return (
    <ScrollView style={styles.container}>
      <View style={{ marginBottom: 12 }}>
        <BizPhoto photoUrl={b.photoUrl} name={b.name} height={190} radius={12} />
      </View>
      <Text style={styles.title}>{b.name}</Text>
      {where ? <Text style={styles.muted}>{where}</Text> : null}
      {b.avgRating != null ? (
        <Text style={{ marginTop: 4 }}>
          <Text style={{ color: "#e8a200" }}>
            {"★".repeat(Math.round(b.avgRating)) + "☆".repeat(5 - Math.round(b.avgRating))}
          </Text>
          <Text style={{ fontWeight: "600" }}>  {b.avgRating}</Text>
          <Text style={styles.muted}>  ·  {b.reviewCount} review{b.reviewCount === 1 ? "" : "s"}</Text>
        </Text>
      ) : null}

      {b.phones.map((p) => (
        <Pressable key={p.e164} style={styles.callBtn} onPress={() => call(p.e164)}>
          <Text style={styles.callText}>📞 Call {p.e164}</Text>
        </Pressable>
      ))}

      {b.websiteUrl ? (
        <Pressable style={styles.linkBtn} onPress={() => Linking.openURL(b.websiteUrl!)}>
          <Text style={styles.link}>🌐 Visit website</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fafafa" },
  title: { fontSize: 24, fontWeight: "700", color: "#1a1a1a" },
  muted: { color: "#777", marginTop: 4 },
  callBtn: { backgroundColor: "#0b6", borderRadius: 10, padding: 14, marginTop: 14, alignItems: "center" },
  callText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  linkBtn: { padding: 14, marginTop: 10, alignItems: "center" },
  link: { color: "#0b6", fontSize: 16 },
});
