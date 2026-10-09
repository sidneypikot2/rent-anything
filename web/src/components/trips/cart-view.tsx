"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Toast } from "@/components/ui/toast";
import { DisplayTitle } from "@/components/ui/typography";
import { EditTripSheet, type EditFocus } from "./edit-trip-sheet";
import { formatDateRange, itemCount } from "./format";
import { ItemDateSheet } from "./item-date-sheet";
import { PickTripSheet } from "./pick-trip-sheet";
import { TripGroup, type TripActions } from "./trip-group";
import {
  currentTrips,
  useDeleteTrip,
  useMergeTrip,
  useRemoveTripItem,
  useTrips,
  useUpdateTripItem,
  type Trip,
  type TripItem,
} from "./use-trips";

// The sheet or dialog open over the cart, if any.
type Open =
  | { kind: "edit"; trip: Trip; focus: EditFocus }
  | { kind: "merge"; trip: Trip }
  | { kind: "delete"; trip: Trip }
  | { kind: "move"; trip: Trip; item: TripItem }
  | { kind: "redate"; trip: Trip; item: TripItem }
  | { kind: "remove"; trip: Trip; item: TripItem };

// The cart (screens 6 and 7): every trip the guest has, each with its items, and the
// sheets that fix a wrong suggestion — move an item, re-date it, merge two trips. One trip
// is open at first: `expandTripId` (from "View trip"), or the first.
export function CartView({ expandTripId }: { expandTripId?: number }) {
  const trips = useTrips(true);
  const [toggled, setToggled] = useState<Record<number, boolean>>({});
  const [open, setOpen] = useState<Open | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);
  const moveItem = useUpdateTripItem();
  const mergeTrip = useMergeTrip();
  const deleteTrip = useDeleteTrip();
  const removeItem = useRemoveTripItem();

  const show = useCallback((text: string) => setNotice({ id: Date.now(), text }), []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const mutations = [moveItem, mergeTrip, deleteTrip, removeItem];
  const pending = mutations.some((mutation) => mutation.isPending);

  // Not while a request runs: resetting it would drop its onSuccess (the toast).
  function close() {
    if (pending) return;
    setOpen(null);
    for (const mutation of mutations) mutation.reset();
  }

  function done(text: string) {
    setOpen(null);
    for (const mutation of mutations) mutation.reset();
    show(text);
  }

  // "View trip" lands here with the trip open; bring it into view once it has loaded.
  const loaded = trips.isSuccess;
  useEffect(() => {
    if (loaded && expandTripId) document.getElementById(`trip-${expandTripId}`)?.scrollIntoView({ block: "start" });
  }, [loaded, expandTripId]);

  const actions: TripActions = {
    edit: (trip, focus = "name") => setOpen({ kind: "edit", trip, focus }),
    merge: (trip) => setOpen({ kind: "merge", trip }),
    remove: (trip) => setOpen({ kind: "delete", trip }),
    moveItem: (trip, item) => setOpen({ kind: "move", trip, item }),
    redateItem: (trip, item) => setOpen({ kind: "redate", trip, item }),
    removeItem: (trip, item) => setOpen({ kind: "remove", trip, item }),
  };

  if (trips.isPending) {
    return <p className="text-sm text-muted">Loading your trips…</p>;
  }
  if (trips.isError) {
    return (
      <p role="alert" className="text-sm text-danger">
        {trips.error.message}
      </p>
    );
  }

  const list = trips.data;
  const firstOpenId = list.some((trip) => trip.id === expandTripId) ? expandTripId : list[0]?.id;
  const others = (trip: Trip) => currentTrips(list).filter((other) => other.id !== trip.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DisplayTitle>Your trips</DisplayTitle>
        <ButtonLink href="/trips" variant="soft" size="sm">
          All trips
        </ButtonLink>
      </div>

      {list.length === 0 ? (
        <Card data-testid="cart-empty">
          <CardBody pad="lg" className="flex flex-col items-start gap-3">
            <p className="font-semibold">No trips yet</p>
            <p className="text-sm text-muted">
              Pick a destination and tap Add to trip on anything you like. Your first add starts a trip.
            </p>
            <ButtonLink href="/" size="sm">
              Find a destination
            </ButtonLink>
          </CardBody>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {list.map((trip) => (
            <TripGroup
              key={trip.id}
              trip={trip}
              open={toggled[trip.id] ?? trip.id === firstOpenId}
              onToggle={() =>
                setToggled((before) => ({ ...before, [trip.id]: !(before[trip.id] ?? trip.id === firstOpenId) }))
              }
              actions={actions}
            />
          ))}
        </div>
      )}

      {open?.kind === "edit" && (
        <EditTripSheet
          trip={open.trip}
          focus={open.focus}
          onClose={close}
          onSaved={(trip) => done(`Saved ${trip.name}`)}
        />
      )}

      {open?.kind === "redate" && (
        <ItemDateSheet
          trip={open.trip}
          item={open.item}
          onClose={close}
          onSaved={(trip) => {
            const dates = formatDateRange(trip.starts_on, trip.ends_on);
            done(dates ? `Date changed · ${trip.name} is ${dates}` : "Date changed");
          }}
        />
      )}

      {open?.kind === "move" && (
        <PickTripSheet
          title="Move to another trip"
          summary={open.item.listing.title}
          trips={others(open.trip)}
          confirmLabel="Move here"
          pending={moveItem.isPending}
          error={moveItem.error?.message}
          onClose={close}
          data-testid="move-item-sheet"
          onPick={(into) =>
            moveItem.mutate(
              { id: open.item.id, changes: { move_to_trip_id: into.id } },
              { onSuccess: (trip) => done(`Moved to ${trip.name}`) },
            )
          }
        />
      )}

      {open?.kind === "merge" && (
        <PickTripSheet
          title="Merge with another trip"
          summary={`${itemCount(open.trip.items.length)} from ${open.trip.name} move into the trip you pick, and ${open.trip.name} is deleted.`}
          trips={others(open.trip)}
          confirmLabel="Merge"
          pending={mergeTrip.isPending}
          error={mergeTrip.error?.message}
          onClose={close}
          data-testid="merge-trip-sheet"
          onPick={(into) =>
            mergeTrip.mutate(
              { id: open.trip.id, intoTripId: into.id },
              {
                onSuccess: (trip) => {
                  setToggled((before) => ({ ...before, [trip.id]: true }));
                  done(`Merged into ${trip.name}`);
                },
              },
            )
          }
        />
      )}

      {open?.kind === "delete" && (
        <Dialog
          open
          onClose={close}
          title="Delete this trip?"
          data-testid="delete-trip-dialog"
          actions={
            <>
              <Button type="button" variant="soft" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                data-testid="delete-trip-confirm"
                disabled={deleteTrip.isPending}
                onClick={() => deleteTrip.mutate(open.trip.id, { onSuccess: () => done(`Deleted ${open.trip.name}`) })}
              >
                {deleteTrip.isPending ? "Deleting…" : "Delete trip"}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {open.trip.name} and its {itemCount(open.trip.items.length)} will be deleted. This can&apos;t be undone.
          </p>
          {deleteTrip.error && (
            <p role="alert" className="text-sm text-danger">
              {deleteTrip.error.message}
            </p>
          )}
        </Dialog>
      )}

      {open?.kind === "remove" && (
        <Dialog
          open
          onClose={close}
          title="Remove from trip?"
          data-testid="remove-item-dialog"
          actions={
            <>
              <Button type="button" variant="soft" onClick={close}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                data-testid="remove-item-confirm"
                disabled={removeItem.isPending}
                onClick={() =>
                  removeItem.mutate(open.item.id, { onSuccess: () => done(`Removed ${open.item.listing.title}`) })
                }
              >
                {removeItem.isPending ? "Removing…" : "Remove"}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {open.item.listing.title} will be removed from {open.trip.name}.
          </p>
          {removeItem.error && (
            <p role="alert" className="text-sm text-danger">
              {removeItem.error.message}
            </p>
          )}
        </Dialog>
      )}

      <Toast data-testid="cart-toast" message={notice?.text ?? null} id={notice?.id} onDismiss={dismissNotice} />
    </>
  );
}
