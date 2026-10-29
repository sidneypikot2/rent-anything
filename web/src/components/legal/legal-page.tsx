import { PageBanner } from "@/components/landing/page-banner";
import { PageSheet } from "@/components/landing/page-sheet";
import { Section } from "@/components/ui/section";
import { DisplayTitle } from "@/components/ui/typography";

// The legal pages linked from the footer: Privacy, Terms, Partner terms, Refunds. Placeholder
// text until the reviewed policies are in; the drafts are with the team.
export const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/partner-terms", label: "Partner terms" },
  { href: "/refunds", label: "Refunds" },
];

const LOREM = [
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
  "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
];

export function LegalPage({ title, sections }: { title: string; sections: string[] }) {
  return (
    <main className="flex flex-1 flex-col">
      <PageBanner search={false} title={<DisplayTitle className="text-balance">{title}</DisplayTitle>}>
        <p className="max-w-lede text-pretty text-sky-mist">Placeholder text: the final wording is on its way.</p>
      </PageBanner>
      <PageSheet tone="clear">
        <div className="page-sections mx-auto flex w-full max-w-page flex-col gap-section py-page-pad">
          {sections.map((heading) => (
            <Section key={heading} surface="glass" title={heading}>
              <div className="flex max-w-prose flex-col gap-4 text-pretty text-sky-mist">
                {LOREM.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </Section>
          ))}
        </div>
      </PageSheet>
    </main>
  );
}
