"use client";

import React from "react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { VideoPreviewProps } from "@/lib/landingpage/video-preview-props";

export function VideoPreview({
  videoUrl,
  mobileVideoUrl,
  webmVideoUrl,
  posterUrl,
  controls = true,
  autoplay = false,
  muted = false,
  loop = false,
  objectFit = "cover",
  borderRadius = 24,
  aspectRatio = "16 / 9",
  maxWidth,
  width = "100%",
  height,
  align = "center",
  shadow = true,
  backgroundColor = "transparent",
  padding = 0,
  className = "",
  preload = "none",
  lazy = true
}: VideoPreviewProps) {
  const [failed, setFailed] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy || autoplay);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const frameRadius = typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius;
  const paddingValue = typeof padding === "number" ? `${padding}px` : padding;
  const wrapperStyle: CSSProperties = {
    width,
    maxWidth,
    marginLeft: align === "center" || align === "right" ? "auto" : undefined,
    marginRight: align === "center" || align === "left" ? "auto" : undefined,
    backgroundColor,
    padding: paddingValue
  };
  const frameStyle: CSSProperties = {
    aspectRatio: normalizeAspectRatio(aspectRatio),
    height,
    borderRadius: frameRadius,
    boxShadow: shadow ? "0 24px 60px rgba(0,0,0,.18)" : "none"
  };

  useEffect(() => {
    if (shouldLoad || !lazy) return undefined;
    const element = wrapperRef.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "420px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [lazy, shouldLoad]);

  if (!videoUrl && !mobileVideoUrl && !webmVideoUrl) {
    return <div ref={wrapperRef} className={className} style={wrapperStyle}><div className="video-frame grid place-items-center p-8 text-center text-sm font-semibold text-white/70" style={frameStyle}>Video noch nicht hinterlegt</div></div>;
  }

  return (
    <div ref={wrapperRef} className={className} style={wrapperStyle}>
      <div className="video-frame" style={frameStyle}>
        {failed ? (
          <div className="grid h-full w-full place-items-center bg-[#0b1020] p-6 text-center text-white">
            <div>
              <p className="text-sm font-semibold">Video konnte nicht geladen werden</p>
              <p className="mt-2 text-xs text-white/70">URL prüfen</p>
            </div>
          </div>
        ) : shouldLoad ? (
          <video
            poster={posterUrl || undefined}
            controls={controls}
            autoPlay={autoplay}
            muted={muted || autoplay}
            loop={loop}
            playsInline
            preload={preload}
            style={{ objectFit }}
            onError={(event) => {
              const code = event.currentTarget.error?.code;
              console.error("Video konnte nicht geladen werden", { videoUrl, code });
              setFailed(true);
            }}
          >
            {mobileVideoUrl ? <source src={mobileVideoUrl} media="(max-width: 767px)" type="video/mp4" /> : null}
            {webmVideoUrl ? <source src={webmVideoUrl} type="video/webm" /> : null}
            {videoUrl ? <source src={videoUrl} type="video/mp4" /> : null}
          </video>
        ) : posterUrl ? (
          <img src={posterUrl} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" style={{ objectFit }} />
        ) : (
          <div className="h-full w-full bg-[#0b1020]" />
        )}
      </div>
      <style jsx>{`
        .video-frame {
          width: 100%;
          overflow: hidden;
          background: #0b1020;
        }

        .video-frame video {
          width: 100%;
          height: 100%;
          display: block;
          background: #0b1020;
        }

        @media (max-width: 767px) {
          .video-frame {
            max-width: 100%;
            border-radius: 18px !important;
          }
        }
      `}</style>
    </div>
  );
}

function normalizeAspectRatio(value: string) {
  if (value.includes(":")) return value.replace(":", " / ");
  return value || "16 / 9";
}
