// What a stay's attrs mean in words (RAA-82, RAA-95): the values the API's attribute_schema
// allows, with the label a partner picks and a guest reads. The partner's stay fields and the
// guest's listing rows (RAA-125) both use these.

export const PLACE_TYPES = [
  { value: "entire_place", label: "Entire place", description: "Guests have the whole place to themselves." },
  {
    value: "private_room",
    label: "Private room",
    description: "Guests have their own room and share some spaces with others.",
  },
  { value: "shared_room", label: "Shared room", description: "Guests sleep in a room or dorm shared with others." },
];

export const BED_TYPES = [
  { value: "single", label: "Single bed" },
  { value: "double", label: "Double bed" },
  { value: "queen", label: "Queen bed" },
  { value: "king", label: "King bed" },
  { value: "bunk", label: "Bunk bed" },
  { value: "sofa_bed", label: "Sofa bed" },
  { value: "floor_mattress", label: "Floor mattress" },
];

export const BATHROOM_TYPES = [
  { value: "private", label: "Private bathroom", description: "Only the guests who book it use it." },
  { value: "shared", label: "Shared bathroom", description: "Guests share it with other people." },
];

export const DORM_TYPES = [
  { value: "mixed", label: "Mixed", description: "Anyone can book a bed." },
  { value: "female_only", label: "Female only", description: "Only women can book a bed." },
  { value: "male_only", label: "Male only", description: "Only men can book a bed." },
];

export const SHARED_WITH = [
  { value: "host", label: "The host" },
  { value: "host_family", label: "The host's family" },
  { value: "other_guests", label: "Other guests" },
];

export const AMENITY_GROUPS = [
  {
    name: "Essentials",
    amenities: [
      { value: "wifi", label: "Wi-Fi" },
      { value: "aircon", label: "Air conditioning" },
      { value: "fan", label: "Electric fan" },
      { value: "hot_shower", label: "Hot shower" },
      { value: "towels_linens", label: "Towels and bed linen" },
      { value: "toiletries", label: "Toiletries" },
      { value: "drinking_water", label: "Drinking water" },
    ],
  },
  {
    name: "Kitchen and living",
    amenities: [
      { value: "kitchen", label: "Kitchen" },
      { value: "refrigerator", label: "Refrigerator" },
      { value: "tv", label: "TV" },
      { value: "workspace", label: "Workspace" },
      { value: "washing_machine", label: "Washing machine" },
    ],
  },
  {
    name: "Outside",
    amenities: [
      { value: "free_parking", label: "Free parking" },
      { value: "pool", label: "Pool" },
      { value: "beachfront", label: "Beachfront" },
      { value: "balcony", label: "Balcony" },
      { value: "garden", label: "Garden" },
    ],
  },
  {
    name: "Services",
    amenities: [
      { value: "breakfast_included", label: "Breakfast included" },
      { value: "airport_pickup", label: "Airport or port pickup" },
      { value: "backup_power", label: "Backup power" },
    ],
  },
  {
    name: "Safety",
    amenities: [
      { value: "smoke_alarm", label: "Smoke alarm" },
      { value: "fire_extinguisher", label: "Fire extinguisher" },
      { value: "first_aid_kit", label: "First aid kit" },
      { value: "cctv", label: "CCTV outside" },
    ],
  },
];

export const STAY_LABELS: Record<string, string> = Object.fromEntries(
  [
    ...PLACE_TYPES,
    ...BED_TYPES,
    ...BATHROOM_TYPES,
    ...DORM_TYPES,
    ...SHARED_WITH,
    ...AMENITY_GROUPS.flatMap((group) => group.amenities),
  ].map((option) => [option.value, option.label]),
);

