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
  imagePath: string;
};

export const ScreenSlide: React.FC<ScreenSlideProps> = ({
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
      </div>
    </AbsoluteFill>
  );
};

