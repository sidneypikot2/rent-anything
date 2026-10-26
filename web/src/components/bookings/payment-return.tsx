"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatPeso } from "@/lib/money";
import { Paid, TEST_MODE_NOTE } from "./pay-sheet";
import { usePayment, type Payment } from "./use-bookings";

const TITLES: Record<Payment["status"], string> = {
  paid: "You're booked",
  pending: "Confirming your payment…",
  failed: "Payment didn't go through",
  needs_refund: "Your payment came in late",
};

// Coming back to the cart from PayMongo's checkout (`/cart?payment=<id>`, on paying or on
// going back): how the payment stands, asked again while PayMongo confirms it. Closing it
// drops the query from the address, so a reload doesn't show it again.
export function PaymentReturn({ id }: { id: number }) {
  const router = useRouter();
  const payment = usePayment(id);
  const data = payment.data;

  function close() {
    router.replace("/cart");
  }

  return (
    <Dialog
      open
      onClose={close}
      placement="sheet"
      title={data ? TITLES[data.status] : "Checking your payment…"}
      data-testid="payment-return"
      actions={
        <Button type="button" onClick={close}>
          {data?.status === "paid" ? "Done" : "Back to the cart"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4" data-testid="payment-status" data-status={data?.status}>
        {payment.error && (
          <p role="alert" className="text-sm text-danger">
            {payment.error.message}
          </p>
        )}
        {data && <Status payment={data} />}
        {data?.test_mode && <p className="text-sm text-muted">{TEST_MODE_NOTE}</p>}
      </div>
    </Dialog>
  );
}

function Status({ payment }: { payment: Payment }) {
  const amount = formatPeso(payment.amount_cents);
  switch (payment.status) {
    case "paid":
      return (
        <>
          <p className="text-sm">{amount} paid.</p>
          <Paid bookings={payment.bookings} />
        </>
      );
    case "pending":
      return (
        <p className="text-sm">
          PayMongo hasn&apos;t confirmed your payment of {amount} yet. This page updates by itself; if you left
          PayMongo&apos;s page without paying, pay again from the trip while your dates are still held.
        </p>
      );
    case "failed":
      return (
        <p className="text-sm">
          Nothing was charged. Your dates are held until the pay-by time on each booking: pay again from the trip.
        </p>
      );
    case "needs_refund":
      return (
        <p className="text-sm">
          Your payment of {amount} came in after your dates were released, so they weren&apos;t booked. We&apos;ll
          refund it in full.
        </p>
      );
  }
}
