"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { PLAYER_IMAGE_FALLBACK, TEAM_LOGO_FALLBACK } from "@/lib/media/nba-images";

type EntityImageProps = {
  src?: string;
  fallbackSrc: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
  title?: string;
  loading?: "lazy" | "eager";
};

function EntityImage({
  src,
  fallbackSrc,
  alt,
  className,
  fallbackLabel,
  title,
  loading = "lazy",
}: EntityImageProps) {
  const [failedPrimary, setFailedPrimary] = useState(false);
  const [failedFallback, setFailedFallback] = useState(false);

  const resolvedSrc = useMemo(() => {
    if (failedFallback) return "";
    if (failedPrimary || !src) return fallbackSrc;
    return src;
  }, [failedFallback, failedPrimary, fallbackSrc, src]);

  if (!resolvedSrc) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-md bg-secondary text-xs font-semibold text-muted-foreground",
          className
        )}
        title={title}
      >
        {fallbackLabel || "NBA"}
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      title={title}
      loading={loading}
      decoding="async"
      className={cn("object-cover", className)}
      onError={() => {
        if (!failedPrimary && src) {
          setFailedPrimary(true);
          return;
        }
        setFailedFallback(true);
      }}
    />
  );
}

type TeamLogoProps = {
  src?: string;
  abbreviation?: string;
  alt?: string;
  className?: string;
  title?: string;
  loading?: "lazy" | "eager";
};

export function TeamLogo({
  src,
  abbreviation,
  alt,
  className,
  title,
  loading = "lazy",
}: TeamLogoProps) {
  return (
    <EntityImage
      src={src}
      fallbackSrc={TEAM_LOGO_FALLBACK}
      alt={alt || `${abbreviation || "NBA"} logo`}
      className={className}
      fallbackLabel={(abbreviation || "NBA").slice(0, 3).toUpperCase()}
      title={title}
      loading={loading}
    />
  );
}

type PlayerAvatarProps = {
  src?: string;
  name?: string;
  initials?: string;
  className?: string;
  title?: string;
  loading?: "lazy" | "eager";
};

export function PlayerAvatar({
  src,
  name,
  initials,
  className,
  title,
  loading = "lazy",
}: PlayerAvatarProps) {
  return (
    <EntityImage
      src={src}
      fallbackSrc={PLAYER_IMAGE_FALLBACK}
      alt={name || "Player avatar"}
      className={className}
      fallbackLabel={(initials || name || "P").slice(0, 2).toUpperCase()}
      title={title || name}
      loading={loading}
    />
  );
}

