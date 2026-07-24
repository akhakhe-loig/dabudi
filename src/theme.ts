// Настройки внешнего вида приложения (сохраняются в localStorage).

export interface AppTheme {
  accent: string; // ключ из ACCENTS
  wallpaper: string; // ключ из WALLPAPERS
  radius: "sharp" | "normal" | "soft";
  dark: boolean;
}

export interface AccentPreset {
  key: string;
  name: string;
  accent: string;
  accentDark: string;
}

// Палитра акцентных цветов. accent -> --accent, accentDark -> --accent-dark
export const ACCENTS: AccentPreset[] = [
  { key: "blue", name: "Синий", accent: "#007AFF", accentDark: "#0051D6" },
  { key: "sky", name: "Голубой", accent: "#32ADE6", accentDark: "#0A84C2" },
  { key: "pink", name: "Розовый", accent: "#FF3D8B", accentDark: "#D81E6A" },
  { key: "rose", name: "Коралловый", accent: "#FF6B57", accentDark: "#E14C38" },
  { key: "purple", name: "Сиреневый", accent: "#AF67E9", accentDark: "#8944C4" },
  { key: "mint", name: "Мятный", accent: "#34C759", accentDark: "#248A3D" },
  { key: "indigo", name: "Индиго", accent: "#5E5CE6", accentDark: "#3F3DBF" },
  { key: "amber", name: "Медовый", accent: "#FF9F0A", accentDark: "#C77700" },
];

export interface RadiusPreset {
  key: AppTheme["radius"];
  name: string;
  value: string;
}

export const RADII: RadiusPreset[] = [
  { key: "sharp", name: "Строгое", value: "0.5rem" },
  { key: "normal", name: "Обычное", value: "0.9rem" },
  { key: "soft", name: "Мягкое", value: "1.5rem" },
];

export interface WallpaperPreset {
  key: string;
  name: string;
  file: string | null;
  swatch: string;
}

export const WALLPAPERS: WallpaperPreset[] = [
  { key: "none", name: "Без обоев", file: null, swatch: "" },
  { key: "pink", name: "Розовые цветы", file: "wallpapers/flowers-pink.svg", swatch: "#FF7EB6" },
  { key: "sky", name: "Голубые цветы", file: "wallpapers/flowers-sky.svg", swatch: "#6FA8FF" },
  { key: "purple", name: "Сиреневые цветы", file: "wallpapers/flowers-purple.svg", swatch: "#B98FE6" },
];

export const DEFAULT_THEME: AppTheme = {
  accent: "blue",
  wallpaper: "none",
  radius: "normal",
  dark: true,
};

export const getAccent = (key: string): AccentPreset =>
  ACCENTS.find((a) => a.key === key) ?? ACCENTS[0];

export const getRadiusValue = (key: AppTheme["radius"]): string =>
  (RADII.find((r) => r.key === key) ?? RADII[1]).value;

export const getWallpaper = (key: string): WallpaperPreset =>
  WALLPAPERS.find((w) => w.key === key) ?? WALLPAPERS[0];

// Абсолютный URL файла обоев с учётом базового пути (GitHub Pages / корень).
export const wallpaperUrl = (key: string): string | null => {
  const wp = getWallpaper(key);
  return wp.file ? `${import.meta.env.BASE_URL}${wp.file}` : null;
};
