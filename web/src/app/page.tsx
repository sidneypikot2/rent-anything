import { ApiStatus } from "@/components/api-status";

// Placeholder home until the area pages exist (M2). The first area is Moalboal.
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Plan your trip to Moalboal</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-400">
        Tours, airport transfers, motorbikes, freediving gear and stays, booked together in one
        cart.
      </p>
      <ApiStatus />
    </main>
  );
}
