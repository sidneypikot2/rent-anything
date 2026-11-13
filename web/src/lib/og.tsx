import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { BRAND_PARTS, TAGLINE } from "@/lib/brand";

// The brand drawn for images made with next/og (RAA-233): the default share image
// (app/opengraph-image.tsx) and the logo search engines show for the business (app/logo.png).
// next/og renders outside the page and can't read globals.css, so the Sky & Forest colours it
// uses are mirrored here, from one place: change a token in globals.css and change it here too.
export const OG_PALETTE = {
  navy: "#0f172a", // --color-navy
  forest: "#14532d", // --color-forest
  lagoonInk: "#0a4f4c", // --color-lagoon-ink
  skyDeep: "#0369a1", // --color-sky-deep
  aqua: "#dbeafe", // --color-aqua
  skyMist: "#e0f2fe", // --color-sky-mist
  mint: "#86efac", // --color-mint
} as const;

// The site's one family, Plus Jakarta Sans (next/font serves it to pages, but next/og needs the
// files): the static TrueType cuts in src/assets/fonts (OFL, licence beside them). Both images
// are made at build time, where the source tree is there.
export async function ogFonts() {
  const font = (file: string) => readFile(join(process.cwd(), "src/assets/fonts", file));
  const [medium, extraBold] = await Promise.all([font("PlusJakartaSans-Medium.ttf"), font("PlusJakartaSans-ExtraBold.ttf")]);
  return [
    { name: "Jakarta", data: medium, weight: 500 as const, style: "normal" as const },
    { name: "Jakarta", data: extraBold, weight: 800 as const, style: "normal" as const },
  ];
}

const { navy, forest, lagoonInk, skyDeep, aqua, skyMist, mint } = OG_PALETTE;

// The site's band: sky water over deep forest, as the trip bands and the footer.
const BAND = `linear-gradient(135deg, ${skyDeep} 0%, ${lagoonInk} 55%, ${forest} 100%)`;

// The wordmark as <Logo> draws it: "TripKo" white, "Next" aqua, extra-bold.
function Wordmark({ size }: { size: number }) {
  const [first, second] = BRAND_PARTS;
  return (
    <div style={{ display: "flex", fontFamily: "Jakarta", fontSize: size, fontWeight: 800, letterSpacing: -size / 40, color: "white" }}>
      <span>
        {first}
        <span style={{ color: aqua }}>{second}</span>
      </span>
    </div>
  );
}

// 1200×630: the wordmark and tagline on the band, a mint rule between them.
export function ShareCard() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: navy, padding: 28 }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          flex: 1,
          borderRadius: 40,
          backgroundImage: BAND,
          padding: "0 88px",
        }}
      >
        <Wordmark size={128} />
        <div style={{ display: "flex", width: 120, height: 8, borderRadius: 4, background: mint, margin: "36px 0" }} />
        <div style={{ display: "flex", fontFamily: "Jakarta", fontSize: 54, fontWeight: 500, color: skyMist }}>{TAGLINE}</div>
      </div>
    </div>
  );
}

// Square: the wordmark alone on the band.
export function LogoCard() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", backgroundImage: BAND }}>
      <Wordmark size={76} />
    </div>
  );
}
