import { useState } from "react";
import { View, TextInput, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import type { BusinessListing } from "@bizfinder/shared";
import { api } from "@/lib/api";
import { BizPhoto } from "@/components/BizPhoto";

export default function SearchScreen() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<BusinessListing[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function runSearch() {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      setResults(await api.search({ q: q.trim(), limit: 20, offset: 0 }));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search businesses (name, type)…"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={runSearch}
        returnKeyType="search"
        autoCapitalize="none"
      />
      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      {!loading && searched && results.length === 0 && <Text style={styles.muted}>No results.</Text>}
      <FlatList
        data={results}
        keyExtractor={(b) => String(b.id)}
        renderItem={({ item }) => (
          <Link href={`/business/${item.slug}`} asChild>
            <Pressable style={styles.card}>
              <View style={{ width: 56 }}>
                <BizPhoto photoUrl={item.photoUrl} name={item.name} height={56} radius={8} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.muted}>
                  {[item.location?.town, item.location?.county].filter(Boolean).join(", ")}
                  {item.avgRating != null ? `  ★ ${item.avgRating} (${item.reviewCount})` : ""}
                </Text>
              </View>
            </Pressable>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#fafafa" },
  input: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 12, fontSize: 16 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 12, marginTop: 10, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 17, fontWeight: "600", color: "#1a1a1a" },
  muted: { color: "#777", marginTop: 4 },
});
