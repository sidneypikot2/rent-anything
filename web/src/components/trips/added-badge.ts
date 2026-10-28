// An add's confirmation, in place of a toast (which covered the card just tapped on a phone,
// 2026-10-29): a small "Added to trip" square in the middle of the screen, as shops' apps do, that
// then shrinks into the header's cart bag, so the guest sees where the cart is, and the bag pops.
// Nothing in it can be tapped, and it's only decoration: the provider's live region says what was
// added. With reduced motion, or no bag on the page, it fades out where it is.

const ARRIVE_MS = 180;
const HOLD_MS = 800;
const LEAVE_MS = 350;
const SIZE = 140;

const TICK = "M5 12.5l4.5 4.5L19 7.5";

let current: HTMLElement | null = null;

function bump(bag: HTMLElement) {
  bag.classList.remove("cart-bump");
  void bag.offsetWidth;
  bag.classList.add("cart-bump");
}

export function showAddedBadge() {
  current?.remove();
  const bag = document.querySelector<HTMLElement>('[data-testid="nav-cart"]');
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const badge = document.createElement("div");
  badge.setAttribute("aria-hidden", "true");
  badge.className =
    "pointer-events-none fixed z-50 flex flex-col items-center justify-center gap-2 rounded-card bg-navy/85 p-3 text-center text-sm font-semibold text-white shadow-float backdrop-blur-lg";
  badge.style.width = `${SIZE}px`;
  badge.style.height = `${SIZE * 0.8}px`;
  badge.style.left = `calc(50% - ${SIZE / 2}px)`;
  badge.style.top = `calc(50% - ${(SIZE * 0.8) / 2}px)`;
  badge.innerHTML = `<svg viewBox="0 0 24 24" class="size-10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${TICK}"/></svg><span>Added to trip</span>`;
  // An add from a side panel or sheet happens inside a modal <dialog>, in the browser's top layer
  // above any z-index, so the badge is a popover in that layer too (as Toast is), opened after
  // the dialog and so above it. The popover's own margin, border, inset and overflow are undone.
  badge.popover = "manual";
  badge.classList.add("m-0", "border-0", "overflow-visible");
  badge.style.right = "auto";
  badge.style.bottom = "auto";
  document.body.append(badge);
  badge.showPopover();
  current = badge;

  const ease = getComputedStyle(document.documentElement).getPropertyValue("--ease-calm").trim() || "ease-out";
  const total = ARRIVE_MS + HOLD_MS + LEAVE_MS;
  const arrived = ARRIVE_MS / total;
  const leaving = (ARRIVE_MS + HOLD_MS) / total;

  let end = "scale(0.92)";
  if (bag && !still) {
    const box = badge.getBoundingClientRect();
    const to = bag.getBoundingClientRect();
    const dx = to.left + to.width / 2 - (box.left + box.width / 2);
    const dy = to.top + to.height / 2 - (box.top + box.height / 2);
    end = `translate(${dx}px, ${dy}px) scale(0.15)`;
  }

  const animation = badge.animate(
    [
      { opacity: 0, transform: "scale(0.92)", easing: ease },
      { opacity: 1, transform: "none", offset: arrived },
      { opacity: 1, transform: "none", offset: leaving, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
      { opacity: 0, transform: end },
    ],
    { duration: total, fill: "forwards" },
  );
  animation.finished
    .catch(() => undefined)
    .then(() => {
      badge.remove();
      if (current === badge) current = null;
      if (bag && !still && bag.isConnected) bump(bag);
    });
}
