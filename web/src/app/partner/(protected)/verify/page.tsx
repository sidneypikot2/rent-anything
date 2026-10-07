"use client";

import { type ReactNode, useEffect } from "react";
import {
  type PartnerVerification,
  usePartnerVerification,
  useStartVerification,
} from "@/components/partner/use-partner-verification";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { DisplayTitle } from "@/components/ui/typography";

// The partner's ID check (RAA-45): where it is started, and where Didit sends the partner
// back. Didit adds its own query parameters; the API's status is what counts, and it is
// polled while the check is unfinished.
export default function PartnerVerify() {
  const { data, error, refetch } = usePartnerVerification({ poll: true });

  return (
    <main data-testid="partner-verify" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <DisplayTitle>Verify your ID</DisplayTitle>
      {data ? (
        <VerificationStatus verification={data} />
      ) : error ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">
            Couldn&apos;t load your ID check.
          </p>
          <Button size="sm" variant="soft" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Loading your ID check…</p>
      )}
    </main>
  );
}

const ABOUT =
  "You'll scan a government ID and take a quick selfie on Didit's secure page; it takes a few minutes. " +
  "We keep only the result, never the photos.";

function VerificationStatus({ verification }: { verification: PartnerVerification }) {
  const { status, attempts_left: attemptsLeft, retry_at: retryAt } = verification;

  switch (status) {
    case "approved":
      return (
        <StatusCard title="Your ID is verified" body="You can add listings now.">
          <ButtonLink href="/partner/listings/new" data-testid="verify-add-listing">
            Add a listing
          </ButtonLink>
        </StatusCard>
      );
    case "in_review":
      return (
        <StatusCard
          title="Your ID is being reviewed"
          body="Didit is checking your ID. This page updates by itself once there's a decision, usually within minutes."
        />
      );
    case "in_progress":
      return (
        <StatusCard title="Your ID check isn't finished" body={`Pick up where you left off. ${ABOUT}`}>
          <StartButton label="Continue verification" />
        </StatusCard>
      );
    case "declined":
      return (
        <StatusCard
          title="Your ID wasn't approved"
          body={
            retryAt
              ? `You've used all your tries for now. You can try again after ${formatTime(retryAt)}.`
              : `Make sure the ID is valid, the photo is sharp and your face is well lit. ${triesLeft(attemptsLeft)}`
          }
        >
          <StartButton label="Try again" disabled={Boolean(retryAt)} />
        </StatusCard>
      );
    default:
      // not_started, or expired: an abandoned check starts over.
      return (
        <StatusCard
          title={status === "expired" ? "Your ID check expired" : "Verify your ID to start listing"}
          body={`Every partner verifies their ID before adding a listing. ${ABOUT}`}
        >
          <StartButton label="Verify your ID" />
        </StatusCard>
      );
  }
}

function StatusCard({ title, body, children }: { title: string; body: string; children?: ReactNode }) {
  return (
    <Card data-testid="verify-status">
      <CardBody pad="lg" className="flex flex-col items-start gap-4">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-muted">{body}</p>
        </div>
        {children}
      </CardBody>
    </Card>
  );
}

function StartButton({ label, disabled = false }: { label: string; disabled?: boolean }) {
  const start = useStartVerification();
  // Success navigates away to Didit, so the button stays busy until the page unloads. Back
  // from Didit, the browser may restore this page as it was: free the button again.
  const { reset } = start;
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => event.persisted && reset();
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [reset]);
  const busy = start.isPending || start.isSuccess;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button data-testid="verify-start" disabled={disabled || busy} onClick={() => start.mutate()}>
        {busy ? "Opening Didit…" : label}
      </Button>
      {start.error && (
        <p role="alert" className="text-sm text-danger">
          {start.error.message}
        </p>
      )}
    </div>
  );
}

function triesLeft(count: number) {
  return count === 1 ? "You have 1 try left before a short wait." : `You have ${count} tries left.`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
