"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { cn } from "@/components/ui/cn";
import { isApiPhoto } from "./sample-photos";

// A banner's photo, slowly drifting (animate-drift), and paused once the banner scrolls out of
// sight, so a long page isn't animating a photo nobody can see. It picks up where it stopped.
export function DriftingPhoto({ src, alt, sizes, className }: { src: string; alt: string; sizes: string; className?: string }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const image = ref.current;
    if (!image) return;
    const observer = new IntersectionObserver(([entry]) => {
      image.style.animationPlayState = entry.isIntersecting ? "" : "paused";
    });
    observer.observe(image);
    return () => observer.disconnect();
  }, []);

  return (
    <Image
      ref={ref}
      src={src}
      alt={alt}
      fill
      preload
      unoptimized={isApiPhoto(src)}
      sizes={sizes}
      className={cn("motion-safe:animate-drift", className)}
    />
  );
}
