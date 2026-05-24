import type { VideoPreviewSettings } from "@/lib/landingpage/video-preview-props";
import { videoPreviewPropsFromSettings } from "@/lib/landingpage/video-preview-props";
import { landingClassNames, landingDesignTokens } from "@/styles/landing-design";
import { VideoPreview } from "./video-preview";

type LandingVideoProps = {
  settings: VideoPreviewSettings;
  className?: string;
  compact?: boolean;
};

export function LandingVideo({ settings, className, compact = false }: LandingVideoProps) {
  const props = videoPreviewPropsFromSettings({
    ...settings,
    videoAspectRatio: settings.videoAspectRatio || landingDesignTokens.video.aspectRatio,
    videoBorderRadius: settings.videoBorderRadius || landingDesignTokens.radius.video,
    videoMaxWidth: settings.videoMaxWidth || landingDesignTokens.layout.videoWidth,
    videoObjectFit: settings.videoObjectFit || "cover",
    videoShadow: settings.videoShadow !== false
  });

  return (
    <div className={landingClassNames("landing-video w-full", compact && "landing-video-compact", className)}>
      <VideoPreview
        {...props}
        maxHeight={compact ? landingDesignTokens.video.mobileMaxHeight : landingDesignTokens.video.desktopMaxHeight}
      />
    </div>
  );
}
