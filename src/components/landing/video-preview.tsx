"use client";

import React from "react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Play } from "lucide-react";
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
  maxHeight,
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
    maxHeight,
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
    return (
      <div ref={wrapperRef} className={className} style={wrapperStyle}>
        <div className="video-frame grid place-items-center p-8 text-center text-sm font-semibold text-white/70" style={frameStyle}>
          <VideoPlaceholder label="Video noch nicht hinterlegt" />
        </div>
      </div>
    );
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
          <div className="relative h-full w-full">
            <img src={posterUrl} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" style={{ objectFit }} />
            <VideoPlayOverlay />
          </div>
        ) : (
          <VideoPlaceholder label="Video wird geladen" />
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

        .video-placeholder {
          min-height: 100%;
          background:
            radial-gradient(circle at 50% 42%, rgba(37, 99, 235, 0.22), transparent 34%),
            linear-gradient(135deg, #111827 0%, #172033 100%);
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

function VideoPlaceholder({ label }: { label: string }) {
  return (
    <div className="video-placeholder flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white text-slate-950 shadow-lg" aria-hidden="true">
        <Play className="ml-0.5 h-6 w-6 fill-slate-950" />
      </span>
      <span className="text-sm font-semibold text-white/75">{label}</span>
    </div>
  );
}

function VideoPlayOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center bg-slate-950/10">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 text-slate-950 shadow-lg backdrop-blur" aria-hidden="true">
        <Play className="ml-0.5 h-6 w-6 fill-slate-950" />
      </span>
    </div>
  );
}
