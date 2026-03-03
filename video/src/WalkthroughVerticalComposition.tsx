import {
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  useVideoConfig,
} from "remotion";
import screensManifest from "../screens.json";
import { OpeningScreen } from "./OpeningScreen";
import { ScreenSlide } from "./ScreenSlide";
import { CtaScreen } from "./CtaScreen";

const FPS = 30;
const OVERLAP_FRAMES = 24;
const OPENING_DURATION_SECONDS = 4;
const CTA_DURATION_SECONDS = 6;

type ScreenConfig = {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  duration: number;
  bullets?: string[];
};

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

type SceneExtras = {
  camera?: CameraFocus;
  cursor?: CursorKeyframe[];
};

type ScreensManifest = {
  projectName: string;
  screens: ScreenConfig[];
};

const typedManifest = screensManifest as ScreensManifest;

const sceneExtrasById: Record<string, SceneExtras> = {
  home: { camera: { x: 0.6, y: 0.4, zoom: 1.1 } },
  login: { camera: { x: 0.5, y: 0.48, zoom: 1.12 } },
  profile: { camera: { x: 0.45, y: 0.35, zoom: 1.13 } },
  "member-dashboard": { camera: { x: 0.42, y: 0.45, zoom: 1.1 } },
  booking: { camera: { x: 0.55, y: 0.38, zoom: 1.15 } },
  events: { camera: { x: 0.5, y: 0.42, zoom: 1.15 } },
};

export const WalkthroughVerticalComposition: React.FC = () => {
  const slides = typedManifest.screens;
  const audioSrc = staticFile("audio/background.mp3");
  const { durationInFrames } = useVideoConfig();

  let accumulatedFrom = 0;

  return (
    <AbsoluteFill>
      <Audio
        src={audioSrc}
        volume={(f) => {
          const fadeInFrames = 30;
          const fadeOutFrames = 30;
          const fadeIn = Math.min(1, f / fadeInFrames);
          const fadeOut = Math.min(
            1,
            (durationInFrames - f) / fadeOutFrames
          );
          return Math.min(fadeIn, fadeOut) * 0.6;
        }}
      />
      {slides.map((screen, index) => {
        const durationInFrames = Math.round(screen.duration * FPS);
        const from =
          index === 0
            ? openingDurationInFrames
            : Math.max(openingDurationInFrames, accumulatedFrom - OVERLAP_FRAMES);
        const sequenceDuration = durationInFrames + OVERLAP_FRAMES;

        accumulatedFrom += durationInFrames;

        const extras = sceneExtrasById[screen.id] ?? {};

        return (
          <Sequence
            key={screen.id}
            from={from}
            durationInFrames={sequenceDuration}
          >
            <ScreenSlide
              id={screen.id}
              title={screen.title}
              description={screen.description}
              imagePath={screen.imagePath}
              index={index}
              totalSlides={slides.length}
              slideDurationInFrames={durationInFrames}
              slideOffsetInFrames={from}
              cameraFocus={extras.camera}
              cursorScript={extras.cursor}
              variant="vertical"
              bullets={screen.bullets}
            />
          </Sequence>
        );
      })}

      <Sequence
        from={Math.max(0, accumulatedFrom - OVERLAP_FRAMES)}
        durationInFrames={Math.round(CTA_DURATION_SECONDS * FPS) + OVERLAP_FRAMES}
      >
        <CtaScreen />
      </Sequence>
    </AbsoluteFill>
  );
};

