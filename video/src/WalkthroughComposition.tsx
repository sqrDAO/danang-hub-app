import {
  AbsoluteFill,
  Sequence,
  Audio,
  staticFile,
  useVideoConfig,
} from "remotion";
import screensManifest from "../screens.json";
import { ScreenSlide } from "./ScreenSlide";
import { CtaScreen } from "./CtaScreen";

const FPS = 30;
const OVERLAP_FRAMES = 24;
const CTA_DURATION_SECONDS = 6;

type ScreenConfig = {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  duration: number;
  bullets?: string[];
};

type ScreensManifest = {
  projectName: string;
  screens: ScreenConfig[];
};

const typedManifest = screensManifest as ScreensManifest;

export const WalkthroughComposition: React.FC = () => {
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
          const fadeOut = Math.min(1, (durationInFrames - f) / fadeOutFrames);
          return Math.min(fadeIn, fadeOut) * 0.6;
        }}
      />
      {slides.map((screen, index) => {
        const durationInFrames = Math.round(screen.duration * FPS);
        const from =
          index === 0 ? 0 : Math.max(0, accumulatedFrom - OVERLAP_FRAMES);
        const sequenceDuration = durationInFrames + OVERLAP_FRAMES;

        accumulatedFrom += durationInFrames;

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
