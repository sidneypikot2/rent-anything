"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/card";
import { LOGIN_PATHS, withNext } from "@/lib/auth/paths";
import { EmailCodeForm } from "./email-code-form";

// /login/code (RAA-177): a guest who booked without a password signs in with an emailed code,
// then lands on `next` or the cart.
export function CodeSignIn({ next }: { next?: string }) {
  const router = useRouter();
  return (
    <Card data-testid="guest-code-signin" className="w-full self-start">
      <CardBody pad="lg" className="flex flex-col gap-5">
        <h1 className="font-display text-2xl font-extrabold tracking-tight">Sign in with a code</h1>
        <EmailCodeForm onSignedIn={() => router.replace(next ?? "/cart")} />
        <p className="text-center text-sm text-muted">
          Have a password?{" "}
          <Link href={withNext(LOGIN_PATHS.guest, next)} className="font-semibold text-link hover:underline">
            Sign in
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
