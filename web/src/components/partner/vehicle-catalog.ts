import type { Transmission } from "@/components/listings/vehicle-labels";

// The makes and models PH rental shops rent out most (RAA-150), per vehicle category slug,
// each with its engine size and usual transmission. Only suggestions: the partner can type
// any make or model, and change the cc and transmission a pick fills in.

export type CatalogModel = { model: string; cc: number; transmission: Transmission };
export type CatalogMake = { make: string; models: CatalogModel[] };

const MOTORCYCLES: CatalogMake[] = [
  {
    make: "Honda",
    models: [
      { model: "Click 125", cc: 125, transmission: "automatic" },
      { model: "Click 160", cc: 157, transmission: "automatic" },
      { model: "BeAT", cc: 110, transmission: "automatic" },
      { model: "Genio", cc: 110, transmission: "automatic" },
      { model: "ADV 160", cc: 157, transmission: "automatic" },
      { model: "PCX 160", cc: 157, transmission: "automatic" },
      { model: "TMX 125 Alpha", cc: 125, transmission: "manual" },
      { model: "TMX Supremo 150", cc: 150, transmission: "manual" },
      { model: "XRM 125", cc: 125, transmission: "semi_automatic" },
      { model: "Wave 110", cc: 110, transmission: "semi_automatic" },
    ],
  },
  {
    make: "Yamaha",
    models: [
      { model: "NMAX 155", cc: 155, transmission: "automatic" },
      { model: "Aerox 155", cc: 155, transmission: "automatic" },
      { model: "Mio i 125", cc: 125, transmission: "automatic" },
      { model: "Mio Sporty", cc: 115, transmission: "automatic" },
      { model: "Fazzio", cc: 125, transmission: "automatic" },
      { model: "Sniper 155", cc: 155, transmission: "manual" },
      { model: "XTZ 125", cc: 125, transmission: "manual" },
    ],
  },
  {
    make: "Suzuki",
    models: [
      { model: "Raider R150", cc: 147, transmission: "manual" },
      { model: "Raider J 115 Fi", cc: 113, transmission: "semi_automatic" },
      { model: "Smash 115", cc: 113, transmission: "semi_automatic" },
      { model: "Burgman Street 125", cc: 124, transmission: "automatic" },
    ],
  },
  {
    make: "Kawasaki",
    models: [
      { model: "Barako II 175", cc: 175, transmission: "manual" },
      { model: "Rouser NS160", cc: 160, transmission: "manual" },
      { model: "Rouser NS200", cc: 199, transmission: "manual" },
    ],
  },
];

const CARS: CatalogMake[] = [
  {
    make: "Toyota",
    models: [
      { model: "Vios", cc: 1329, transmission: "automatic" },
      { model: "Wigo", cc: 998, transmission: "automatic" },
      { model: "Avanza", cc: 1496, transmission: "automatic" },
      { model: "Innova", cc: 2755, transmission: "automatic" },
      { model: "Fortuner", cc: 2755, transmission: "automatic" },
    ],
  },
  {
    make: "Mitsubishi",
    models: [
      { model: "Mirage G4", cc: 1193, transmission: "automatic" },
      { model: "Xpander", cc: 1499, transmission: "automatic" },
      { model: "Montero Sport", cc: 2442, transmission: "automatic" },
    ],
  },
  { make: "Honda", models: [{ model: "City", cc: 1498, transmission: "automatic" }, { model: "BR-V", cc: 1498, transmission: "automatic" }] },
  { make: "Nissan", models: [{ model: "Almera", cc: 999, transmission: "automatic" }] },
  { make: "Suzuki", models: [{ model: "Ertiga", cc: 1462, transmission: "automatic" }, { model: "Dzire", cc: 1197, transmission: "automatic" }] },
];

const VANS: CatalogMake[] = [
  {
    make: "Toyota",
    models: [
      { model: "Hiace Commuter", cc: 2755, transmission: "manual" },
      { model: "Hiace GL Grandia", cc: 2755, transmission: "automatic" },
    ],
  },
  { make: "Nissan", models: [{ model: "NV350 Urvan", cc: 2488, transmission: "manual" }] },
  { make: "Hyundai", models: [{ model: "Starex", cc: 2497, transmission: "automatic" }, { model: "Staria", cc: 2199, transmission: "automatic" }] },
  { make: "Foton", models: [{ model: "Traveller", cc: 2776, transmission: "manual" }] },
];

const TRICYCLES: CatalogMake[] = [
  {
    make: "Honda",
    models: [
      { model: "TMX 125 Alpha", cc: 125, transmission: "manual" },
      { model: "TMX Supremo 150", cc: 150, transmission: "manual" },
    ],
  },
  { make: "Kawasaki", models: [{ model: "Barako II 175", cc: 175, transmission: "manual" }] },
  { make: "Suzuki", models: [{ model: "Raider J 115 Fi", cc: 113, transmission: "semi_automatic" }] },
];

const MULTICABS: CatalogMake[] = [
  {
    make: "Suzuki",
    models: [
      { model: "Multicab", cc: 658, transmission: "manual" },
      { model: "Carry", cc: 1462, transmission: "manual" },
      { model: "Every", cc: 658, transmission: "manual" },
    ],
  },
];

const CATALOG: Record<string, CatalogMake[]> = {
  motorcycle: MOTORCYCLES,
  car: CARS,
  "van-rental": VANS,
  tricycle: TRICYCLES,
  multicab: MULTICABS,
};

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export function catalogMakes(slug: string | undefined) {
  return (slug && CATALOG[slug]) || [];
}

// The models to suggest: the typed make's, or every make's while it matches none.
export function catalogModels(slug: string | undefined, make: string) {
  const makes = catalogMakes(slug);
  const known = makes.find((entry) => same(entry.make, make));
  return (known ? [known] : makes).flatMap((entry) => entry.models.map((model) => ({ make: entry.make, ...model })));
}
