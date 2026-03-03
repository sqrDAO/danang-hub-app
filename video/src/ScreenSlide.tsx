import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ScreenSlideProps = {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  index: number;
  totalSlides: number;
  bullets?: string[];
};

export const ScreenSlide: React.FC<ScreenSlideProps> = ({
  title,
  description,
  imagePath,
  index,
  totalSlides,
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Header entrance — slides down from above
  const headerSlide = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.7 },
  });
  const headerY = interpolate(headerSlide, [0, 1], [-12, 0]);

  // Zoom — increased to 8%, smoother spring
  const zoomProgress = spring({
    frame,
    fps,
    config: { damping: 28, stiffness: 90, mass: 0.6 },
    durationInFrames,
  });
  const zoomScale = 1 + zoomProgress * 0.08;

  // Fade in/out — extended windows
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    frame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = fadeIn * fadeOut;

  // Title — spring slide-up + extended opacity ramp
  const titleSpring = spring({
    frame: frame - 6,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [20, 0]);
  const titleOpacity = interpolate(frame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Description — staggered spring slide-up + extended opacity ramp
  const descSpring = spring({
    frame: frame - 14,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const descY = interpolate(descSpring, [0, 1], [16, 0]);
  const descriptionOpacity = interpolate(frame, [14, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress fill for the active slide bar
  const progressFill = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const imageSrc = staticFile(imagePath);

  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(circle at top left, #1e293b, #020617 40%, #000000 80%)",
        color: "white",
        fontFamily:
          "system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif",
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          gap: 24,
          padding: 32,
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at top left, rgba(56,189,248,0.16), transparent 55%)",
            pointerEvents: "none",
          }}
        />
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: 2,
            textTransform: "uppercase",
            color: "#e5e7eb",
            transform: `translateY(${headerY}px)`,
          }}
        >
          <div>Da Nang Blockchain Hub</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 14,
              opacity: 0.9,
            }}
          >
            <span style={{ color: "#38bdf8" }}>Member Journey</span>
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "999px",
                backgroundColor: "#38bdf8",
              }}
            />
            <span>
              Step {index + 1} of {totalSlides}
            </span>
          </div>
        </header>

        <main
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
            gap: 32,
            flex: 1,
            alignItems: "center",
          }}
        >
          <div
            style={{
              position: "relative",
              width: "100%",
              padding: 24,
              borderRadius: 24,
              background:
                "linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.4))",
              boxShadow:
                "0 24px 60px rgba(15,23,42,0.75), 0 0 0 1px rgba(148,163,184,0.15)",
              overflow: "hidden",
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
                transform: `scale(${zoomScale})`,
                transformOrigin: "center center",
              }}
            >
              <Img
                src={imageSrc}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  borderRadius: 18,
                  boxShadow: "0 18px 40px rgba(15,23,42,0.9)",
                }}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 32,
                fontWeight: 650,
                letterSpacing: 0.4,
                lineHeight: 1.3,
                opacity: titleOpacity,
                transform: `translateY(${titleY}px)`,
              }}
            >
              {title}
            </div>
            <div
              style={{
                fontSize: 18,
                lineHeight: 1.6,
                color: "#e5e7eb",
                opacity: descriptionOpacity,
                transform: `translateY(${descY}px)`,
              }}
            >
              {description}
            </div>

            {bullets && bullets.length > 0 && (
              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  fontSize: 14,
                  color: "#9ca3af",
                  opacity: descriptionOpacity,
                }}
              >
                {bullets.map((bullet, i) => (
                  <div
                    key={i}
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "999px",
                        backgroundColor: i === 0 ? "#38bdf8" : "#4ade80",
                      }}
                    />
                    <span>{bullet}</span>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                marginTop: "auto",
                display: "flex",
                gap: 8,
                alignItems: "center",
              }}
            >
              {Array.from({ length: totalSlides }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 999,
                    backgroundColor: "rgba(148,163,184,0.3)",
                    overflow: "hidden",
                    position: "relative",
                    boxShadow:
                      i === index
                        ? "0 0 12px rgba(56,189,248,0.9)"
                        : "none",
                  }}
                >
                  {i === index && (
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        height: "100%",
                        width: `${progressFill * 100}%`,
                        backgroundColor: "#38bdf8",
                        borderRadius: 999,
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </AbsoluteFill>
  );
};
