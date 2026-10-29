import Link from "next/link";
import type { ChangeEvent } from "react";
import { oauthProviderNames } from "@/components/auth/oauth-buttons";
import { CheckboxField } from "@/components/ui/checkbox-field";

// The links open in a new tab, so reading them never loses what was typed in the form.
function PolicyLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} target="_blank" rel="noopener" className="font-semibold text-link underline underline-offset-4 hover:text-primary">
      {children}
    </Link>
  );
}

// "I agree to the Terms and Privacy Policy" on every form that creates an account or hands
// us someone's details: sign-up (guest and partner) and checkout without an account. Required,
// so the form can't be sent without it. A partner also agrees to the Partner terms.
export function ConsentField({
  partner = false,
  checked,
  onChange,
}: {
  partner?: boolean;
  checked?: boolean;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <CheckboxField
      name="terms"
      required
      checked={checked}
      onChange={onChange}
      data-testid="consent"
      className="items-start py-1 font-normal text-pretty [&>input]:mt-0.5"
      label={
        <span>
          I agree to the <PolicyLink href="/terms">Terms</PolicyLink>
          {partner && (
            <>
              , the <PolicyLink href="/partner-terms">Partner terms</PolicyLink>
            </>
          )}{" "}
          and the <PolicyLink href="/privacy">Privacy policy</PolicyLink>.
        </span>
      }
    />
  );
}

// For a button that may create an account without a form to tick (Google or Facebook on a
// sign-in page): saying it is the agreement. Names only the buttons shown.
export function ConsentNote({ partner = false }: { partner?: boolean }) {
  return (
    <p className="text-center text-xs text-pretty text-muted" data-testid="consent-note">
      By continuing with {oauthProviderNames()}, you agree to the <PolicyLink href="/terms">Terms</PolicyLink>
      {partner && (
        <>
          , the <PolicyLink href="/partner-terms">Partner terms</PolicyLink>
        </>
      )}{" "}
      and the <PolicyLink href="/privacy">Privacy policy</PolicyLink>.
    </p>
  );
}
