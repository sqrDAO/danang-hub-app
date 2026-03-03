import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const CTA_URL = "https://app.danangblockchainhub.com";

export const CtaScreen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Label slides up
  const labelSpring = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 100, mass: 0.7 },
  });
  const labelY = interpolate(labelSpring, [0, 1], [10, 0]);

  // Title slides up
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.7 },
  });

  // Body paragraph — delayed fade
  const bodyOpacity = interpolate(frame, [20, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Status dot — delayed fade
  const statusOpacity = interpolate(frame, [30, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // URL pill — further delayed fade
  const urlOpacity = interpolate(frame, [40, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // QR bounce entrance
  const qrBounce = spring({
    frame: frame - 10,
    fps,
    config: { damping: 18, stiffness: 140, mass: 0.9 },
  });
  const qrScale = 0.92 + qrBounce * 0.08;

  // Subtle pulsing glow on QR card
  const glowPulse = interpolate(
    Math.sin((frame / fps) * Math.PI * 0.4),
    [-1, 1],
    [0.12, 0.22]
  );

  const qrSrc = staticFile("screens/cta-qr.png");

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at top, #0f172a, #020617 45%, #000000 90%)",
        color: "white",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "40px 64px",
        boxSizing: "border-box",
        opacity: fadeIn,
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
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 48,
        }}
      >
        <div
          style={{
            flex: 1.6,
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <div
            style={{
              fontSize: 18,
              letterSpacing: 2,
              textTransform: "uppercase",
              color: "#38bdf8",
              opacity: labelSpring * 0.9,
              transform: `translateY(${labelY}px)`,
            }}
          >
            Da Nang Blockchain Hub
          </div>
          <div
            style={{
              fontSize: 42,
              fontWeight: 650,
              lineHeight: 1.15,
              transform: `translateY(${(1 - titleSpring) * 16}px)`,
              opacity: titleSpring,
            }}
          >
            Become a member
            <br />
            and join the community.
          </div>
          <div
            style={{
              fontSize: 18,
              lineHeight: 1.7,
              color: "#e5e7eb",
              maxWidth: 520,
              opacity: bodyOpacity,
            }}
          >
            Scan the QR code to open the member portal, create your profile, and
            start booking workspaces and events at Da Nang Blockchain Hub.
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              marginTop: 8,
              fontSize: 14,
              color: "#9ca3af",
              opacity: statusOpacity,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "999px",
                backgroundColor: "#22c55e",
                boxShadow: "0 0 12px rgba(34,197,94,0.8)",
              }}
            />
            <span>Available on desktop and mobile browsers</span>
          </div>
          <div
            style={{
              marginTop: 22,
              padding: "10px 16px",
              borderRadius: 999,
              border: "1px solid rgba(148,163,184,0.5)",
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              color: "#cbd5f5",
              background: "rgba(15,23,42,0.7)",
              opacity: urlOpacity,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: "#38bdf8",
              }}
            />
            <span>{CTA_URL}</span>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              padding: 28,
              borderRadius: 24,
              background:
                "linear-gradient(145deg, rgba(15,23,42,0.98), rgba(15,23,42,0.8))",
              boxShadow:
                "0 28px 80px rgba(15,23,42,0.9), 0 0 0 1px rgba(148,163,184,0.3)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Pulsing glow overlay */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 24,
                background:
                  "radial-gradient(circle, rgba(56,189,248,0.6), transparent 65%)",
                opacity: glowPulse,
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                transform: `scale(${qrScale})`,
                transformOrigin: "center center",
              }}
            >
              <Img
                src={qrSrc}
                style={{
                  width: 260,
                  height: 260,
                  objectFit: "contain",
                  borderRadius: 18,
                  backgroundColor: "white",
                }}
              />
            </div>
            <div
              style={{
                fontSize: 14,
                color: "#e5e7eb",
                textAlign: "center",
                maxWidth: 260,
              }}
            >
              Scan with your phone camera to open the member portal.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
