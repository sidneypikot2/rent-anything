import { BookLoading } from "@/components/area/book-loading";
import { BookLoadingPick } from "@/components/area/book-loading-pick";

// While a place's What to book renders on the server (it waits on the API): the page's own
// banner, dates bar and the skeleton its cards load behind, so the two stages look the same.
export default function AreaBookLoading() {
  return <BookLoadingPick page={<BookLoading />} list={<BookLoading list />} />;
}
