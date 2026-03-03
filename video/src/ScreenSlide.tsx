import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type CameraFocus = {
  x: number;
  y: number;
  zoom: number;
};

type CursorKeyframe = {
  time: number;
  x: number;
  y: number;
  type?: "move" | "click" | "hover";
};

type Variant = "desktop" | "vertical";

type ScreenSlideProps = {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  index: number;
  totalSlides: number;
  slideDurationInFrames: number;
  slideOffsetInFrames?: number;
  cameraFocus?: CameraFocus;
  cursorScript?: CursorKeyframe[];
  variant?: Variant;
  bullets?: string[];
};

export const ScreenSlide: React.FC<ScreenSlideProps> = ({
  id,
  title,
  description,
  imagePath,
  index,
  totalSlides,
  slideDurationInFrames,
  slideOffsetInFrames,
  cameraFocus,
  cursorScript,
  variant = "desktop",
  bullets,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // Inside a Sequence, useCurrentFrame() returns frame relative to sequence start
  const localFrame = frame;
  const durationInFrames = slideDurationInFrames;

  const clampedLocalFrame = Math.max(0, Math.min(localFrame, durationInFrames));

  // Header entrance — slides down from above
  const headerSlide = spring({
    frame: clampedLocalFrame,
    fps,
    config: { damping: 20, stiffness: 90, mass: 0.7 },
  });
  const headerY = interpolate(headerSlide, [0, 1], [-12, 0]);

  // Zoom — increased to 8%, smoother spring
  const zoomProgress = spring({
    frame: clampedLocalFrame,
    fps,
    config: { damping: 28, stiffness: 90, mass: 0.6 },
    durationInFrames,
  });
  const targetZoom = cameraFocus?.zoom ?? 1.08;
  const zoomScale = 1 + zoomProgress * (targetZoom - 1);

  const focusX = cameraFocus?.x ?? 0.5;
  const focusY = cameraFocus?.y ?? 0.5;

  const panStrength = 20;
  const translateXPercent = (0.5 - focusX) * panStrength;
  const translateYPercent = (0.5 - focusY) * panStrength;

  // Fade in/out — quick fade so content appears immediately
  const fadeIn = interpolate(clampedLocalFrame, [0, 8], [0.3, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const fadeOut = interpolate(
    clampedLocalFrame,
    [durationInFrames - 15, durationInFrames],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const opacity = fadeIn * fadeOut;

  const enterSlide = interpolate(clampedLocalFrame, [0, 12], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const exitSlide = interpolate(
    clampedLocalFrame,
    [durationInFrames - 12, durationInFrames],
    [0, -24],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const contentTranslateX = enterSlide + exitSlide;

  // Title — spring slide-up + extended opacity ramp
  const titleSpring = spring({
    frame: clampedLocalFrame - 6,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const titleY = interpolate(titleSpring, [0, 1], [20, 0]);
  const titleOpacity = interpolate(clampedLocalFrame, [6, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Description — staggered spring slide-up + extended opacity ramp
  const descSpring = spring({
    frame: clampedLocalFrame - 14,
    fps,
    config: { damping: 22, stiffness: 100, mass: 0.8 },
  });
  const descY = interpolate(descSpring, [0, 1], [16, 0]);
  const descriptionOpacity = interpolate(clampedLocalFrame, [14, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress fill for the active slide bar
  const progressFill = interpolate(
    clampedLocalFrame,
    [0, durationInFrames],
    [0, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }
  );

  const slideTimeSeconds = clampedLocalFrame / fps;

  const activeCursorScript = cursorScript ?? [];

  let cursorX = 0.82;
  let cursorY = 0.18;
  let cursorScale = 1;

  if (activeCursorScript.length > 0) {
    let from = activeCursorScript[0];
    let to = activeCursorScript[activeCursorScript.length - 1];

    for (let i = 0; i < activeCursorScript.length - 1; i++) {
      const current = activeCursorScript[i];
      const next = activeCursorScript[i + 1];
      if (slideTimeSeconds >= current.time && slideTimeSeconds <= next.time) {
        from = current;
        to = next;
        break;
      }
    }

    const segmentDuration = Math.max(0.0001, to.time - from.time);
    const rawT = (slideTimeSeconds - from.time) / segmentDuration;
    const t = Math.max(0, Math.min(rawT, 1));

    cursorX = from.x + (to.x - from.x) * t;
    cursorY = from.y + (to.y - from.y) * t;

    const clickKeyframe = activeCursorScript.find(
      (kf) => kf.type === "click"
    );
    if (clickKeyframe) {
      const dt = Math.abs(slideTimeSeconds - clickKeyframe.time);
      const clickWindow = 0.25;
      if (dt < clickWindow) {
        const pulse = 1 - dt / clickWindow;
        cursorScale = 1 + pulse * 0.22;
      }
    }
  }

  const showCursor =
    variant === "desktop" && Number.isFinite(cursorX) && Number.isFinite(cursorY);

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
            gridTemplateColumns:
              variant === "vertical"
                ? "minmax(0, 1fr)"
                : "minmax(0, 3fr) minmax(0, 2fr)",
            gridTemplateRows:
              variant === "vertical"
                ? "minmax(0, 3fr) minmax(0, 2.4fr)"
                : "minmax(0, 1fr)",
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
              transform: `translateX(${contentTranslateX}px)`,
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
                position: "relative",
                transform: `scale(${zoomScale}) translate(${translateXPercent}%, ${translateYPercent}%)`,
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
              {showCursor && (
                <div
                  style={{
                    position: "absolute",
                    left: `${cursorX * 100}%`,
                    top: `${cursorY * 100}%`,
                    transform: `translate(-35%, -20%) scale(${cursorScale}) rotate(-12deg)`,
                    transformOrigin: "top left",
                    width: 28,
                    height: 32,
                    pointerEvents: "none",
                    filter:
                      "drop-shadow(0 4px 10px rgba(15,23,42,0.9)) drop-shadow(0 0 14px rgba(56,189,248,0.7))",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      background:
                        "linear-gradient(145deg, #e5f3ff, #c4e5ff 50%, #7dd3fc)",
                      clipPath:
                        "polygon(0% 0%, 60% 0%, 60% 40%, 100% 40%, 0% 100%)",
                      borderRadius: 6,
                      border: "1px solid rgba(15,23,42,0.25)",
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 18,
              alignSelf: variant === "vertical" ? "stretch" : "center",
            }}
          >
            <div
              style={{
                fontSize: variant === "vertical" ? 40 : 36,
                fontWeight: 700,
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
                fontSize: variant === "vertical" ? 22 : 20,
                lineHeight: 1.7,
                color: "#e5e7eb",
                opacity: descriptionOpacity,
                transform: `translateY(${descY}px)`,
                maxWidth: variant === "vertical" ? 720 : "100%",
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
