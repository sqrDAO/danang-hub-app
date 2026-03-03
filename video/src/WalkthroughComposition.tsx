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
  /**
   * Normalized x position of the focus point within the image (0 = left, 1 = right)
   */
  x: number;
  /**
   * Normalized y position of the focus point within the image (0 = top, 1 = bottom)
   */
  y: number;
  /**
   * Target zoom multiplier when fully focused (1 = no extra zoom).
   */
  zoom: number;
};

type CursorKeyframe = {
  /**
   * Time in seconds from the start of the slide.
   */
  time: number;
  /**
   * Normalized x position within the UI area (0 = left, 1 = right).
   */
  x: number;
  /**
   * Normalized y position within the UI area (0 = top, 1 = bottom).
   */
  y: number;
  /**
   * Optional semantic hint for interaction styling.
   */
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
  home: {
    camera: {
      x: 0.6,
      y: 0.4,
      zoom: 1.1,
    },
    cursor: [
      { time: 0.3, x: 0.15, y: 0.75, type: "move" },
      { time: 1, x: 0.72, y: 0.78, type: "hover" },
      { time: 1.2, x: 0.72, y: 0.78, type: "click" },
      { time: 2.2, x: 0.82, y: 0.16, type: "move" },
    ],
  },
  login: {
    camera: {
      x: 0.5,
      y: 0.48,
      zoom: 1.12,
    },
    cursor: [
      { time: 0.2, x: 0.1, y: 0.8, type: "move" },
      { time: 0.9, x: 0.46, y: 0.42, type: "hover" },
      { time: 1.1, x: 0.46, y: 0.42, type: "click" },
      { time: 2.1, x: 0.54, y: 0.62, type: "hover" },
      { time: 2.3, x: 0.54, y: 0.62, type: "click" },
    ],
  },
  profile: {
    camera: {
      x: 0.45,
      y: 0.35,
      zoom: 1.13,
    },
    cursor: [
      { time: 0.4, x: 0.72, y: 0.25, type: "move" },
      { time: 1, x: 0.72, y: 0.25, type: "hover" },
      { time: 1.2, x: 0.72, y: 0.25, type: "click" },
      { time: 2.3, x: 0.62, y: 0.74, type: "hover" },
    ],
  },
  "member-dashboard": {
    camera: {
      x: 0.42,
      y: 0.45,
      zoom: 1.1,
    },
    cursor: [
      { time: 0.4, x: 0.2, y: 0.76, type: "move" },
      { time: 1, x: 0.28, y: 0.32, type: "hover" },
      { time: 1.2, x: 0.28, y: 0.32, type: "click" },
      { time: 2.3, x: 0.7, y: 0.72, type: "move" },
    ],
  },
  booking: {
    camera: {
      x: 0.55,
      y: 0.38,
      zoom: 1.15,
    },
    cursor: [
      { time: 0.3, x: 0.18, y: 0.18, type: "move" },
      { time: 0.9, x: 0.32, y: 0.18, type: "hover" },
      { time: 1.1, x: 0.32, y: 0.18, type: "click" },
      { time: 1.8, x: 0.64, y: 0.48, type: "move" },
      { time: 2.4, x: 0.64, y: 0.48, type: "click" },
    ],
  },
  events: {
    camera: {
      x: 0.5,
      y: 0.42,
      zoom: 1.15,
    },
    cursor: [
      { time: 0.3, x: 0.2, y: 0.24, type: "move" },
      { time: 1, x: 0.2, y: 0.24, type: "hover" },
      { time: 1.2, x: 0.2, y: 0.24, type: "click" },
      { time: 2.4, x: 0.8, y: 0.78, type: "move" },
    ],
  },
};

export const WalkthroughComposition: React.FC = () => {
  const slides = typedManifest.screens;
  const audioSrc = staticFile("audio/background.mp3");
  const { durationInFrames } = useVideoConfig();

  const openingDurationInFrames = Math.round(OPENING_DURATION_SECONDS * FPS);
  let accumulatedFrom = openingDurationInFrames;

  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={openingDurationInFrames}>
        <OpeningScreen />
      </Sequence>
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
