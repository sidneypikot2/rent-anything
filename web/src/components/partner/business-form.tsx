"use client";

import { useState, type FormEvent } from "react";
import { PhAddressFields, usePhAddress } from "@/components/address/ph-address-fields";
import { FormSection } from "@/components/admin/destination-form";
import { HOUSE_RULE_LABELS, LANGUAGE_LABELS, MAX_FAQS, WEEKDAYS } from "@/components/listings/business-labels";
import { Button, ButtonLink } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox-field";
import { Field } from "@/components/ui/field";
import { TextareaField } from "@/components/ui/textarea-field";
import type { LatLng } from "@/lib/map";
import { BusinessPhotosSection } from "./business-photos-section";
import { addressChanged, areaQuery, geocodeQuery, NO_ADDRESS } from "./listing-fields";
import { LocationPicker } from "./location-picker";
import { TimeSelect } from "./time-fields";
import type { BusinessBody, PartnerBusiness } from "./use-partner-businesses";

type Faq = { question: string; answer: string };

const toggle = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((each) => each !== value) : [...list, value]);

// Adding or changing one of the partner's businesses (RAA-101): its name, which travellers
// see on its listings ("by Basilia Guest House"), an optional description, and its address
// and map pin, which a new listing can copy ("Same as Business Address"). The API checks
// the name is unique among the partner's businesses. Its shop page (RAA-281) also shows what
// the sections below say: opening hours, languages, a host, the rules its stays keep and
// questions guests ask; and, once saved, its logo and cover photos (saved as they change).
export function BusinessForm({
  business,
  onSave,
  saving,
  error,
  cancelHref,
}: {
  business?: PartnerBusiness;
  onSave: (body: BusinessBody) => void;
  saving: boolean;
  error?: Error | null;
  cancelHref: string;
}) {
  const [name, setName] = useState(business?.name ?? "");
  const [description, setDescription] = useState(business?.description ?? "");
  const address = usePhAddress(business?.address ?? NO_ADDRESS);
  const [location, setLocation] = useState<LatLng | null>(business?.location ?? null);
  const [locationError, setLocationError] = useState<string>();
  const [hasHours, setHasHours] = useState(Boolean(business?.hours));
  const [opensAt, setOpensAt] = useState(business?.hours?.opens_at ?? "08:00");
  const [closesAt, setClosesAt] = useState(business?.hours?.closes_at ?? "18:00");
  const [closedDays, setClosedDays] = useState<number[]>(business?.hours?.closed_days ?? []);
  const [hoursError, setHoursError] = useState<string>();
  const [languages, setLanguages] = useState<string[]>(business?.languages ?? []);
  const [hostName, setHostName] = useState(business?.host?.name ?? "");
  const [hostIntro, setHostIntro] = useState(business?.host?.intro ?? "");
  const rules = business?.stay_rules;
  const [checkInFrom, setCheckInFrom] = useState(rules?.check_in_from ?? null);
  const [checkInUntil, setCheckInUntil] = useState(rules?.check_in_until ?? null);
  const [checkOutBy, setCheckOutBy] = useState(rules?.check_out_by ?? null);
  const [houseRules, setHouseRules] = useState<string[]>(rules?.house_rules ?? []);
  const [quietFrom, setQuietFrom] = useState(rules?.quiet_from ?? null);
  const [rulesNote, setRulesNote] = useState(rules?.note ?? "");
  const [faqs, setFaqs] = useState<Faq[]>(business?.faqs ?? []);
  // A saved pin stays where it is until the partner changes the address.
  const addressQuery =
    !business?.location || addressChanged(address, business.address) ? geocodeQuery(address) : undefined;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setLocationError("Drop a pin on the map");
      return;
    }
    if (hasHours && opensAt >= closesAt) {
      setHoursError("Close after you open");
      return;
    }
    const anyRule = checkInFrom || checkInUntil || checkOutBy || quietFrom || houseRules.length > 0 || rulesNote.trim();
    onSave({
      name: name.trim(),
      description: description.trim(),
      address: address.toBody(),
      location,
      hours: hasHours ? { opens_at: opensAt, closes_at: closesAt, closed_days: closedDays } : null,
      languages: languages as NonNullable<BusinessBody["languages"]>,
      host: hostName.trim() ? { name: hostName.trim(), intro: hostIntro.trim() || null } : null,
      stay_rules: anyRule
        ? {
            check_in_from: checkInFrom,
            check_in_until: checkInUntil,
            check_out_by: checkOutBy,
            house_rules: houseRules as NonNullable<NonNullable<BusinessBody["stay_rules"]>["house_rules"]>,
            quiet_from: houseRules.includes("quiet_hours") ? quietFrom : null,
            note: rulesNote.trim() || null,
          }
        : null,
      faqs: faqs
        .map((faq) => ({ question: faq.question.trim(), answer: faq.answer.trim() }))
        .filter((faq) => faq.question || faq.answer),
    });
  }

  const setFaq = (index: number, change: Partial<Faq>) =>
    setFaqs(faqs.map((faq, at) => (at === index ? { ...faq, ...change } : faq)));
  const moveFaq = (index: number, by: number) => {
    const next = [...faqs];
    const [faq] = next.splice(index, 1);
    next.splice(index + by, 0, faq);
    setFaqs(next);
  };

  return (
    <form data-testid="business-form" onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-section">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <FormSection title="About the business">
        <Field
          label="Business name"
          name="name"
          required
          maxLength={80}
          value={name}
          onChange={(event) => setName(event.target.value)}
          hint="Travellers see it on every listing of this business."
          placeholder="e.g. Basilia Guest House"
        />
        <TextareaField
          label="Description (optional)"
          name="description"
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
      </FormSection>

      {business ? (
        <BusinessPhotosSection business={business} />
      ) : (
        <FormSection title="Logo and cover photos">
          <p className="text-sm text-muted">Add them once the business is saved.</p>
        </FormSection>
      )}

      <FormSection title="Where it is">
        <PhAddressFields address={address} />
        <LocationPicker
          label="Pin the business"
          value={location}
          onChange={(point) => {
            setLocation(point);
            setLocationError(undefined);
          }}
          geocodeQuery={addressQuery}
          areaQuery={areaQuery(address)}
          error={locationError}
          onPinAddress={address.fillFromPlace}
        />
        <p className="text-sm text-muted">
          Guests see your street and pin on your shop page, except for a business that only offers stays: they get those once
          booked.
        </p>
      </FormSection>

      <FormSection title="Opening hours">
        <CheckboxField
          label="Show opening hours on my shop page"
          checked={hasHours}
          onChange={(event) => setHasHours(event.target.checked)}
          data-testid="business-hours-on"
        />
        {hasHours && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <TimeSelect label="Opens" value={opensAt} onChange={(value) => setOpensAt(value ?? "08:00")} testId="business-opens-at" />
              <TimeSelect
                label="Closes"
                value={closesAt}
                onChange={(value) => {
                  setClosesAt(value ?? "18:00");
                  setHoursError(undefined);
                }}
                error={hoursError}
                testId="business-closes-at"
              />
            </div>
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">Closed on</legend>
              <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-4">
                {WEEKDAYS.map((day, index) => (
                  <CheckboxField
                    key={day}
                    label={day}
                    checked={closedDays.includes(index)}
                    onChange={() => setClosedDays(toggle(closedDays, index).sort())}
                  />
                ))}
              </div>
            </fieldset>
          </>
        )}
      </FormSection>

      <FormSection title="Languages you speak">
        <div className="grid grid-cols-2 gap-x-4 sm:grid-cols-3" data-testid="business-languages">
          {Object.entries(LANGUAGE_LABELS).map(([value, label]) => (
            <CheckboxField
              key={value}
              label={label}
              value={value}
              checked={languages.includes(value)}
              onChange={() => setLanguages(toggle(languages, value))}
            />
          ))}
        </div>
      </FormSection>

      <FormSection title="Host (for stays)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Host's name (optional)" maxLength={60} value={hostName} onChange={(event) => setHostName(event.target.value)} />
          <Field
            label="One line about them (optional)"
            maxLength={160}
            value={hostIntro}
            onChange={(event) => setHostIntro(event.target.value)}
            placeholder="e.g. Six years on the island"
            disabled={!hostName.trim()}
          />
        </div>
      </FormSection>

      <FormSection title="Stay rules (for stays)">
        <div className="grid gap-4 sm:grid-cols-3">
          <TimeSelect label="Check-in from" value={checkInFrom} onChange={setCheckInFrom} optional testId="business-check-in-from" />
          <TimeSelect label="Check-in until" value={checkInUntil} onChange={setCheckInUntil} optional />
          <TimeSelect label="Check-out by" value={checkOutBy} onChange={setCheckOutBy} optional testId="business-check-out-by" />
        </div>
        <div className="grid gap-x-4 sm:grid-cols-2">
          {Object.entries(HOUSE_RULE_LABELS).map(([value, label]) => (
            <CheckboxField key={value} label={label} checked={houseRules.includes(value)} onChange={() => setHouseRules(toggle(houseRules, value))} />
          ))}
        </div>
        {houseRules.includes("quiet_hours") && (
          <div className="sm:max-w-xs">
            <TimeSelect label="Quiet from" value={quietFrom} onChange={setQuietFrom} optional />
          </div>
        )}
        <TextareaField label="Anything else (optional)" maxLength={300} value={rulesNote} onChange={(event) => setRulesNote(event.target.value)} />
      </FormSection>

      <FormSection title="Good to know">
        <p className="text-sm text-muted">Answer what guests ask you most. Up to {MAX_FAQS}, in the order they show.</p>
        <ol className="flex flex-col gap-4" data-testid="business-faqs">
          {faqs.map((faq, index) => (
            <li key={index} className="flex flex-col gap-3 rounded-control border border-line p-4">
              <Field
                label={`Question ${index + 1}`}
                maxLength={120}
                required
                value={faq.question}
                onChange={(event) => setFaq(index, { question: event.target.value })}
                placeholder="e.g. Can I bring the bike to Madridejos?"
              />
              <TextareaField
                label="Answer"
                maxLength={500}
                required
                value={faq.answer}
                onChange={(event) => setFaq(index, { answer: event.target.value })}
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => moveFaq(index, -1)}>
                  Move up
                </Button>
                <Button type="button" size="sm" variant="ghost" disabled={index === faqs.length - 1} onClick={() => moveFaq(index, 1)}>
                  Move down
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setFaqs(faqs.filter((_, at) => at !== index))}>
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {faqs.length < MAX_FAQS && (
          <Button
            type="button"
            variant="soft"
            size="sm"
            className="self-start"
            data-testid="business-faq-add"
            onClick={() => setFaqs([...faqs, { question: "", answer: "" }])}
          >
            + Add a question
          </Button>
        )}
      </FormSection>

      <div className="flex gap-3">
        <Button type="submit" data-testid="business-save" disabled={saving}>
          {saving ? "Saving…" : business ? "Save changes" : "Add business"}
        </Button>
        <ButtonLink href={cancelHref} variant="soft">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
