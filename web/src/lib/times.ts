// Times as the API takes them, every half hour ("08:30", read "8:30 AM"): a water activity's
// hours and departures (RAA-270), a tour's start times and a business's hours and stay rules
// (RAA-281). Plain functions, so server pages read them too.
export const HALF_HOURS = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? "30" : "00";
  return { value: `${String(hour).padStart(2, "0")}:${minute}`, label: timeLabel(hour, minute) };
});

function timeLabel(hour: number, minute: string) {
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour < 12 ? "AM" : "PM"}`;
}

export function timeText(time: string) {
  return HALF_HOURS.find((option) => option.value === time)?.label ?? time;
}

// An hour after `time`, for the next row of a list; 9 AM to start.
export function nextHalfHour(time: string | undefined) {
  const index = HALF_HOURS.findIndex((option) => option.value === time);
  return HALF_HOURS[Math.min(index + 2, HALF_HOURS.length - 1)]?.value ?? "09:00";
}
