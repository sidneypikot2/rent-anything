"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BankGlyph, ChevronGlyph, ListGlyph, PersonGlyph, SuitcaseGlyph } from "@/components/discovery/tag-glyphs";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { BLOCKER_LABELS, STATUS } from "../listing-status";
import type { PartnerDashboard } from "../use-partner-dashboard";

const ICON = "size-5";

type Item = { key: string; icon: ReactNode; title: string; note: string; href: string };

// What else the partner should do (RAA-284; requests have their own section above): the setup a
// partner needs before guests can book (ID check, profile, business, payout account), then
// listings that aren't live and why. With nothing to do, it says so.
function itemsOf(data: PartnerDashboard): Item[] {
  const items: Item[] = [];
  const { setup } = data;
  if (!setup.id_check) {
    const reviewing = setup.id_check_status === "in_review" || setup.id_check_status === "in_progress";
    items.push({
      key: "id-check",
      icon: <PersonGlyph className={ICON} />,
      title: reviewing ? "Your ID check is under review" : setup.id_check_status === "declined" ? "Your ID check was declined" : "Verify your ID",
      note: reviewing ? "You can add listings once it's approved" : "Needed before you add a listing",
      href: "/partner/verify",
    });
  }
  if (!setup.profile) {
    items.push({ key: "profile", icon: <PersonGlyph className={ICON} />, title: "Complete your profile", note: "Your name and phone", href: "/partner/profile" });
  }
  if (!setup.business) {
    items.push({ key: "business", icon: <SuitcaseGlyph className={ICON} />, title: "Add your business", note: "Every listing belongs to one", href: "/partner/businesses/new" });
  }
  if (!setup.payout_account) {
    items.push({ key: "payout", icon: <BankGlyph className={ICON} />, title: "Add a payout account", note: "Where your earnings go", href: "/partner/settings" });
  }

  for (const listing of data.listings_needing_attention) {
    const todo = listing.live_blockers.map((blocker) => BLOCKER_LABELS[blocker]);
    items.push({
      key: `listing-${listing.id}`,
      icon: <ListGlyph className={ICON} />,
      title: listing.status === "active" ? `${listing.title} can't be booked yet` : `${listing.title} isn't live`,
      note: todo.length ? todo.join(" · ") : STATUS[listing.status].note,
      href: `/partner/listings/${listing.id}`,
    });
  }

  return items;
}

export function NeedsAttention({ data }: { data: PartnerDashboard }) {
  const items = itemsOf(data);

  return (
    <Section testId="needs-attention" title="Needs attention">
      {items.length === 0 ? (
        <p className="text-sm text-muted">All caught up. Nothing needs you right now.</p>
      ) : (
        <Card edge="line">
          <ul className="divide-y divide-line">
            {items.map((item) => (
              <li key={item.key}>
                <AttentionRow item={item} />
              </li>
            ))}
          </ul>
        </Card>
      )}
    </Section>
  );
}

function AttentionRow({ item }: { item: Item }) {
  return (
    <Link
      href={item.href}
      className="flex w-full items-center gap-3 p-4 text-left transition-colors duration-300 ease-calm hover:bg-surface-2"
      data-testid="attention-item"
      data-item={item.key}
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-mist text-primary">{item.icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{item.title}</span>
        <span className="text-sm text-muted">{item.note}</span>
      </span>
      <ChevronGlyph direction="right" className="size-4 shrink-0 text-muted" />
    </Link>
  );
}
