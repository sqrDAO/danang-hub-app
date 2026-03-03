/**
 * Remotion configuration for the Da Nang Hub walkthrough video.
 * See https://www.remotion.dev/docs/config for all available options.
 */

import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
Config.setConcurrency(4);
