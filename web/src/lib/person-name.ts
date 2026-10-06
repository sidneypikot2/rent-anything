// A legal name as it is on an ID (RAA-40): letters in any script (José, Peña), with the
// spaces, hyphens, apostrophes and periods names use ("Ma. Cristina", "Dela Cruz",
// "O'Brien"), starting with a letter. The API holds to the same rule
// (backend/app/models/concerns/profile_address.rb); this only says so sooner.
const NAME_FORMAT = /^\p{L}[\p{L}\p{M} .'’-]*$/u;
export const NAME_MAX = 50;

export function nameError(label: string, value: string) {
  const name = value.trim();
  if (!name) return `${label} is required`;
  if (name.length > NAME_MAX) return `${label} is too long (at most ${NAME_MAX} characters)`;
  if (!NAME_FORMAT.test(name)) return `${label} can only have letters, spaces, hyphens, apostrophes and periods`;
  return undefined;
}
