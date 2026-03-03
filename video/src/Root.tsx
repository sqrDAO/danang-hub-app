import { Composition } from "remotion";
import { WalkthroughComposition } from "./WalkthroughComposition";
import screensManifest from "../screens.json";

const FPS = 30;
const OVERLAP_FRAMES = 15;
const CTA_DURATION_SECONDS = 6;

const slidesDurationInFrames = screensManifest.screens.reduce(
  (sum, screen) => sum + Math.round(screen.duration * FPS),
  0
);

const totalDurationInFrames =
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
        width={1280}
        height={720}
      />
    </>
  );
};

