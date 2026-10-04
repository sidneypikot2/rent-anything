import { ApiStatus } from "@/components/api-status";
import { AuthCard } from "@/components/landing/auth-card";
import { PlaceholderBlock } from "@/components/landing/placeholder-block";
import { DisplayTitle, SectionTitle } from "@/components/ui/typography";

const CATEGORIES = [
  { title: "Tours & activities", note: "Sardine run, canyoneering, island hopping" },
  { title: "Airport transfers", note: "Cebu airport to Moalboal by van or car" },
  { title: "Motorbikes & trikes", note: "Daily and weekly rentals" },
  { title: "Freediving & water gear", note: "Fins, masks, wetsuits, courses" },
  { title: "Stays", note: "Guesthouses and small resorts" },
];

// The guest landing page. Placeholder until the area pages exist (M2); the first area is
// Moalboal. Sign-ups here will create guest accounts (M1).
export default function Home() {
  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-4 py-12 md:grid-cols-[1fr_20rem]">
      <div className="flex flex-col gap-6">
        <DisplayTitle>
          Plan your trip to <span className="not-italic text-primary">Moalboal</span>
        </DisplayTitle>
        <p className="text-lg text-muted">
          Tours, airport transfers, motorbikes, freediving gear and stays, booked together in one
          cart.
        </p>
        <ApiStatus />
        <section className="flex flex-col gap-3">
          <SectionTitle>What you can book</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {CATEGORIES.map((category) => (
              <PlaceholderBlock key={category.title} {...category} />
            ))}
          </div>
        </section>
      </div>
      <AuthCard mode="signup" audience="guest" title="Create a guest account" />
    </main>
  );
}
