import { Composition } from "remotion";
import { WalkthroughComposition } from "./WalkthroughComposition";
import { WalkthroughVerticalComposition } from "./WalkthroughVerticalComposition";
import screensManifest from "../screens.json";

const FPS = 30;
const OVERLAP_FRAMES = 15;
const OPENING_DURATION_SECONDS = 4;
const CTA_DURATION_SECONDS = 6;

const slidesDurationInFrames = screensManifest.screens.reduce(
  (sum, screen) => sum + Math.round(screen.duration * FPS),
  0
);

const totalDurationInFrames =
  Math.round(OPENING_DURATION_SECONDS * FPS) +
  slidesDurationInFrames +
  OVERLAP_FRAMES +
  Math.round(CTA_DURATION_SECONDS * FPS);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MemberWalkthrough"
        component={WalkthroughComposition}
        durationInFrames={totalDurationInFrames}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="MemberWalkthroughVertical"
        component={WalkthroughVerticalComposition}
        durationInFrames={totalDurationInFrames}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};

