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
};

export const ScreenSlide: React.FC<ScreenSlideProps> = ({
  title,
  description,
  imagePath,
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
        opacity,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
        <div
          style={{
            transform: `scale(${zoomScale})`,
            transformOrigin: "center center",
            transition: "transform 0.2s linear",
            width: "100%",
            height: "100%",
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

        <div
          style={{
            position: "absolute",
            left: 32,
            right: 32,
            bottom: 32,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              backdropFilter: "blur(18px)",
              WebkitBackdropFilter: "blur(18px)",
              background:
                "linear-gradient(135deg, rgba(15,23,42,0.88), rgba(15,23,42,0.74))",
              borderRadius: 16,
              border: "1px solid rgba(148,163,184,0.5)",
              padding: "14px 18px",
              boxShadow:
                "0 18px 40px rgba(15,23,42,0.9), 0 0 0 1px rgba(15,23,42,0.8)",
              maxWidth: 640,
              color: "white",
            }}
          >
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                letterSpacing: 0.3,
                lineHeight: 1.3,
                opacity: titleOpacity,
              }}
            >
              {title}
            </div>
            <div
              style={{
                marginTop: 6,
                fontSize: 14,
                lineHeight: 1.6,
                color: "#e5e7eb",
                opacity: descriptionOpacity,
              }}
            >
              {description}
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

