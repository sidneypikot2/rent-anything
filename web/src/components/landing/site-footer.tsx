import Link from "next/link";

// The guest footer: a few links and the line about what we are.
export function SiteFooter() {
  return (
    <footer className="mt-auto bg-navy text-on-dark">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="font-display text-xl font-bold italic text-white">
          Rent-<span className="not-italic text-aqua">Anything</span>
        </p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2 [&_a]:hover:text-white">
          <Link href="/#destinations">Destinations</Link>
          <Link href="/#activities">Activities</Link>
          <Link href="/partner/register">List with us</Link>
        </nav>
        <p>Local partners in Cebu · Book everything for one trip in one cart</p>
      </div>
    </footer>
  );
}
