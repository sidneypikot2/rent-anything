import { cn } from "@/components/ui/cn";

// A drawn scene for a destination card until there are photos (RAA-73): one per kind of
// area, in the palette only. Decorative — the card's heading names the place.
export function AreaScene({ kind, className }: { kind: string; className?: string }) {
  const Scene = SCENES[kind] ?? CoastScene;
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 400 160"
      preserveAspectRatio="xMidYMid slice"
      className={cn("size-full bg-mist", className)}
    >
      <Scene />
    </svg>
  );
}

// A sandbar off a palm-topped island, the sea in bands.
function IslandScene() {
  return (
    <>
      <circle cx="320" cy="56" r="18" className="fill-aqua/40" />
      <rect y="92" width="400" height="68" className="fill-aqua/30" />
      <rect y="112" width="400" height="48" className="fill-cerulean/20" />
      <path d="M150 104c30-18 110-20 150 0z" className="fill-fern/70" />
      <path d="M40 120c50-10 120-8 170 4-60 6-120 6-170-4z" className="fill-sage" />
      <path d="M232 104c-2-20 2-34 12-48" fill="none" strokeWidth="4" strokeLinecap="round" className="stroke-navy/70" />
      <path
        d="M244 56c-14-8-30-6-38 4M244 56c-4-12-18-18-30-16M244 56c10-10 28-12 38-4M244 56c14-2 26 8 28 20"
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        className="stroke-emerald"
      />
      <path d="M0 128c40-6 80 6 120 0s80-6 120 0 80 6 160-2" fill="none" strokeWidth="2" className="stroke-mist" />
    </>
  );
}

// A skyline behind an old fort wall, on the water.
function CityScene() {
  return (
    <>
      <circle cx="340" cy="52" r="16" className="fill-aqua/40" />
      <g className="fill-cerulean/30">
        <rect x="96" y="50" width="26" height="70" />
        <rect x="128" y="64" width="20" height="56" />
        <rect x="154" y="40" width="30" height="80" />
        <rect x="190" y="70" width="22" height="50" />
        <rect x="218" y="56" width="28" height="64" />
      </g>
      <path
        d="M60 120V86h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v-8h12v8h12v34z"
        className="fill-cerulean/60"
      />
      <rect x="114" y="98" width="14" height="22" rx="7" className="fill-mist" />
      <rect y="120" width="400" height="40" className="fill-aqua/30" />
      <path d="M0 130c40-6 80 6 120 0s80-6 120 0 80 6 160-2" fill="none" strokeWidth="2" className="stroke-mist" />
    </>
  );
}

// Rooftops in green hills.
function TownScene() {
  return (
    <>
      <path d="M0 100c70-40 140-40 210-10s130 20 190-6v76H0z" className="fill-fern/50" />
      <path d="M0 124c90-24 200-24 400 0v36H0z" className="fill-emerald/40" />
      <g className="fill-cerulean/70">
        <path d="M150 112v-18l16-12 16 12v18z" />
        <path d="M190 116v-14l13-10 13 10v14z" />
        <path d="M226 110v-20l18-14 18 14v20z" />
      </g>
      <g className="fill-mist">
        <rect x="161" y="100" width="10" height="12" />
        <rect x="238" y="96" width="12" height="14" />
      </g>
    </>
  );
}

// A coastline with its contour lines, for a province or a region.
function CoastScene() {
  return (
    <>
      <rect width="400" height="160" className="fill-aqua/20" />
      <path d="M120 0c-20 40 30 60 10 100s20 60 60 60h210V0z" className="fill-fern/60" />
      <path d="M150 0c-16 40 26 62 8 98s16 52 48 62" fill="none" strokeWidth="2" className="stroke-emerald/50" />
      <path d="M182 0c-12 40 22 62 6 96s12 46 38 64" fill="none" strokeWidth="2" className="stroke-emerald/40" />
      <circle cx="260" cy="70" r="6" className="fill-navy/70" />
    </>
  );
}

const SCENES: Record<string, () => React.JSX.Element> = {
  island: IslandScene,
  city: CityScene,
  town: TownScene,
  province: CoastScene,
  region: CoastScene,
};
