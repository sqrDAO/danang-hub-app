import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const OpeningScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const labelSpring = spring({
    frame,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const labelY = interpolate(labelSpring, [0, 1], [16, 0]);
  const labelOpacity = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const titleSpring = spring({
    frame: frame - 10,
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.9 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [24, 0]);
  const titleOpacity = interpolate(frame, [12, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const taglineSpring = spring({
    frame: frame - 22,
    fps,
    config: { damping: 24, stiffness: 90, mass: 0.8 },
  });
  const taglineY = interpolate(taglineSpring, [0, 1], [12, 0]);
  const taglineOpacity = interpolate(frame, [22, 36], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at top left, #1e293b, #020617 40%, #000000 80%)",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        opacity: fadeIn,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at top left, rgba(56,189,248,0.18), transparent 55%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <div
          style={{
            fontSize: 16,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#38bdf8",
            opacity: labelSpring * labelOpacity,
            transform: `translateY(${labelY}px)`,
          }}
        >
          Member Journey
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: -0.5,
            lineHeight: 1.1,
            textAlign: "center",
            margin: 0,
            opacity: titleSpring * titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          Da Nang Blockchain Hub
        </h1>
        <div
          style={{
            fontSize: 22,
            fontWeight: 500,
            color: "#94a3b8",
            lineHeight: 1.5,
            textAlign: "center",
            maxWidth: 520,
            opacity: taglineSpring * taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          Book spaces, join events, and manage your membership at the builders-first Web3 hub in Central Vietnam
        </div>
      </div>
    </AbsoluteFill>
  );
};
