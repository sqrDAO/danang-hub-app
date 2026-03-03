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
};

export const ScreenSlide: React.FC<ScreenSlideProps> = ({
  title,
  description,
  imagePath,
  index,
  totalSlides,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const zoomProgress = spring({
    frame,
    fps,
    config: {
      damping: 20,
      stiffness: 120,
      mass: 0.6,
    },
    durationInFrames,
  });

  const zoomScale = 1 + zoomProgress * 0.05;

  const fadeIn = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const fadeOut = interpolate(
    frame,
    [durationInFrames - 10, durationInFrames],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const opacity = fadeIn * fadeOut;

  const titleOpacity = interpolate(frame, [6, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const descriptionOpacity = interpolate(frame, [12, 26], [0, 1], {
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
                transition: "transform 0.2s linear",
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
              }}
            >
              {description}
            </div>

            <div
              style={{
                marginTop: 16,
                display: "flex",
                flexDirection: "column",
                gap: 8,
                fontSize: 14,
                color: "#9ca3af",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    backgroundColor: "#38bdf8",
                  }}
                />
                <span>Designed for new hub members</span>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "999px",
                    backgroundColor: "#4ade80",
                  }}
                />
                <span>Shows a single key step in the journey</span>
              </div>
            </div>

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
                    backgroundColor:
                      i === index ? "#38bdf8" : "rgba(148,163,184,0.3)",
                    boxShadow:
                      i === index
                        ? "0 0 12px rgba(56,189,248,0.9)"
                        : "none",
                    transition: "background-color 0.25s ease-out",
                  }}
                />
              ))}
            </div>
          </div>
        </main>
      </div>
    </AbsoluteFill>
  );
};

