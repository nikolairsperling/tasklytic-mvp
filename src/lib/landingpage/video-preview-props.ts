export type VideoPreviewProps = {
  videoUrl?: string | null;
  mobileVideoUrl?: string | null;
  webmVideoUrl?: string | null;
  posterUrl?: string | null;
  controls?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  objectFit?: "cover" | "contain";
  borderRadius?: number | string;
  aspectRatio?: string;
  maxWidth?: string | number;
  maxHeight?: string | number;
  width?: string | number;
  height?: string | number;
  align?: "left" | "center" | "right";
  shadow?: boolean;
  backgroundColor?: string;
  padding?: string | number;
  className?: string;
  preload?: "none" | "metadata" | "auto";
  lazy?: boolean;
};

export type VideoPreviewSettings = {
  videoUrl?: string | null;
  videoMobileUrl?: string | null;
  videoWebmUrl?: string | null;
  thumbnailUrl?: string | null;
  controls?: boolean;
  autoplay?: boolean;
  muted?: boolean;
  loop?: boolean;
  videoObjectFit?: "cover" | "contain";
  videoBorderRadius?: string;
  videoAspectRatio?: string;
  videoMaxWidth?: string;
  videoWidthMode?: "full" | "auto" | "custom";
  videoCustomWidth?: string;
  videoHeightMode?: "auto" | "custom";
  videoCustomHeight?: string;
  videoShadow?: boolean;
  videoBackgroundColor?: string;
  videoPadding?: string;
  videoAlign?: "left" | "center" | "right";
  videoPreload?: "none" | "metadata" | "auto";
};

export function videoPreviewPropsFromSettings(settings: VideoPreviewSettings): VideoPreviewProps {
  return {
    videoUrl: settings.videoUrl,
    mobileVideoUrl: settings.videoMobileUrl,
    webmVideoUrl: settings.videoWebmUrl,
    posterUrl: settings.thumbnailUrl,
    controls: settings.controls !== false,
    autoplay: settings.autoplay === true,
    muted: settings.muted === true,
    loop: settings.loop === true,
    objectFit: settings.videoObjectFit ?? "cover",
    borderRadius: settings.videoBorderRadius ?? "24",
    aspectRatio: settings.videoAspectRatio ?? "16 / 9",
    maxWidth: cssLength(settings.videoMaxWidth ?? "520px"),
    width: settings.videoWidthMode === "auto" ? "auto" : settings.videoWidthMode === "custom" ? cssLength(settings.videoCustomWidth || "520px") : "100%",
    height: settings.videoHeightMode === "custom" ? cssLength(settings.videoCustomHeight || "292px") : undefined,
    align: settings.videoAlign ?? "center",
    shadow: settings.videoShadow !== false,
    backgroundColor: settings.videoBackgroundColor || "transparent",
    padding: settings.videoPadding ?? "0",
    preload: settings.videoPreload ?? (settings.autoplay ? "metadata" : "none"),
    lazy: true
  };
}

function cssLength(value: string | number) {
  if (typeof value === "number") return value;
  if (/^\d+(\.\d+)?$/.test(value.trim())) return `${value}px`;
  return value;
}
