import Image from "next/image";
import type { components } from "@/api/schema";
import { SectionTitle } from "@/components/ui/typography";

type PhotoUrls = components["schemas"]["photo_urls"];

// A listing's photos on its page (RAA-109), in the partner's order: each card-sized, opening
// the whole photo. They are sized by the API and served from storage, so next/image passes
// them through (`unoptimized`).
export function ListingGallery({ title, photos }: { title: string; photos: PhotoUrls[] }) {
  return (
    <section data-testid="listing-gallery" className="flex flex-col gap-2">
      <SectionTitle>Photos</SectionTitle>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photo, index) => (
          <li key={photo.large_url}>
            <a
              href={photo.large_url}
              target="_blank"
              rel="noopener"
              className="card-edge relative block aspect-[4/3] overflow-hidden rounded-control shadow-soft transition-transform duration-500 ease-calm motion-safe:hover:-translate-y-1"
            >
              <Image
                src={photo.card_url}
                alt={`${title}, photo ${index + 1}`}
                fill
                unoptimized
                sizes="(min-width: 640px) 33vw, 50vw"
                className="object-cover"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
