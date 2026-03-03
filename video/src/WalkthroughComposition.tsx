import { AbsoluteFill, Sequence } from "remotion";
import screensManifest from "../screens.json";
import { ScreenSlide } from "./ScreenSlide";
import { CtaScreen } from "./CtaScreen";

const FPS = 30;
const OVERLAP_FRAMES = 15;
const CTA_DURATION_SECONDS = 6;

type ScreenConfig = {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  duration: number;
};

type ScreensManifest = {
  projectName: string;
  screens: ScreenConfig[];
};

const typedManifest = screensManifest as ScreensManifest;

export const WalkthroughComposition: React.FC = () => {
  const slides = typedManifest.screens;

  let accumulatedFrom = 0;

  return (
    <AbsoluteFill>
      {slides.map((screen, index) => {
        const durationInFrames = Math.round(screen.duration * FPS);
        const from =
          index === 0 ? 0 : Math.max(0, accumulatedFrom - OVERLAP_FRAMES);
        const sequenceDuration =
          durationInFrames + (index === 0 ? OVERLAP_FRAMES : OVERLAP_FRAMES);

        accumulatedFrom += durationInFrames;

        return (
          <Sequence
            key={screen.id}
            from={from}
            durationInFrames={sequenceDuration}
          >
            <ScreenSlide
              id={screen.id}
              imagePath={screen.imagePath}
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

