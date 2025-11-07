import { BackgroundTheme } from "../stores/useSettingsStore";

export type AnimatedBackgroundType =
  | "particles"
  | "gradient"
  | "waves"
  | "rain"
  | "clouds"
  | "balatro"
  | "thunderstorm"
  | "space"
  | "ocean"
  | "crystal"
  | "embers"
  | "circuit"
  | "none";

export const mapBackgroundThemeToAnimated = (
  theme: BackgroundTheme | undefined,
): AnimatedBackgroundType => {
  switch (theme) {
    case "fireflies":
    case "embers":
      return "embers";
    case "stars":
    case "space":
      return "space";
    case "gradient":
      return "gradient";
    case "circuit":
      return "circuit";
    case "thunderstorm":
      return "thunderstorm";
    case "ocean":
      return "ocean";
    case "crystal":
      return "crystal";
    case "balatro":
    case "rain":
    case "clouds":
    case "particles":
    case "waves":
      return theme;
    default:
      return "none";
  }
};

export const resolveAnimatedBackgroundType = (
  explicit: AnimatedBackgroundType | undefined,
  fallbackTheme: BackgroundTheme | undefined,
): AnimatedBackgroundType => {
  if (explicit) {
    return explicit;
  }
  return mapBackgroundThemeToAnimated(fallbackTheme);
};
