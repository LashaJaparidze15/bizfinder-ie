import { useState } from "react";
import { Image, View, Text, type DimensionValue } from "react-native";

// Real photo if we have one; otherwise a deterministic colour tile (so a card is never blank).
// Falls back to the tile if the remote image fails to load.
const PALETTE = ["#2b87c3", "#e8862a", "#15a05a", "#a05ad6", "#d6485a", "#3a9fb5", "#c2922a"];
function colorFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = s.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function BizPhoto({
  photoUrl,
  name,
  height,
  width = "100%",
  radius = 10,
}: {
  photoUrl: string | null;
  name: string;
  height: number;
  width?: DimensionValue;
  radius?: number;
}) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      <Image
        source={{ uri: photoUrl }}
        onError={() => setFailed(true)}
        resizeMode="cover"
        style={{ width, height, borderRadius: radius, backgroundColor: "#eee" }}
      />
    );
  }
  return (
    <View
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: colorFor(name),
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: height / 2.5 }}>🏢</Text>
    </View>
  );
}
