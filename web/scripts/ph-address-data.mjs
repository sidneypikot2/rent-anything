// Builds src/lib/ph-address/data.json, the Philippine address suggestions on the partner
// profile form (RAA-40): regions, provinces and cities/municipalities from the PSA's
// Philippine Standard Geographic Code (via psgc.gitlab.io), and ZIP codes from GeoNames
// (CC BY 4.0, credited on the form), joined to cities by province and city name.
// Re-run when either source updates:
//   docker compose run --rm web node scripts/ph-address-data.mjs
import { writeFile } from "node:fs/promises";
import { inflateRawSync } from "node:zlib";

const PSGC = "https://psgc.gitlab.io/api";
const GEONAMES = "https://download.geonames.org/export/zip/PH.zip";
const OUT = new URL("../src/lib/ph-address/data.json", import.meta.url);

async function json(path) {
  const response = await fetch(`${PSGC}/${path}`);
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
}

// The one file we need out of a zip, found through the zip's central directory.
function unzipEntry(buffer, name) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let offset = buffer.readUInt32LE(end + 16);
  for (let i = 0; i < buffer.readUInt16LE(end + 10); i++) {
    const method = buffer.readUInt16LE(offset + 10);
    const size = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const local = buffer.readUInt32LE(offset + 42);
    const entryName = buffer.toString("utf8", offset + 46, offset + 46 + nameLength);
    if (entryName === name) {
      const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const data = buffer.subarray(start, start + size);
      return (method === 0 ? data : inflateRawSync(data)).toString("utf8");
    }
    offset += 46 + nameLength + extraLength + commentLength;
  }
  throw new Error(`${name} not in zip`);
}

// "City of Lapu-Lapu (Opon)", "Lapu-Lapu City" and "Province of Cebu" all reduce to the
// bare place name.
function normalise(name) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/^(city|province|municipality) of /, "")
    .replace(/ (city|municipality)$/, "")
    .replace(/\bsta\. ?/g, "santa ")
    .replace(/\bsto\. ?/g, "santo ")
    .replace(/\bgen\. ?/g, "general ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const [regions, provinces, cities] = await Promise.all([
  json("regions/"),
  json("provinces/"),
  json("cities-municipalities/"),
]);

const zipResponse = await fetch(GEONAMES);
if (!zipResponse.ok) throw new Error(`GeoNames: ${zipResponse.status}`);
const rows = unzipEntry(Buffer.from(await zipResponse.arrayBuffer()), "PH.txt")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.split("\t"));

const provinceName = new Map(provinces.map((p) => [p.code, normalise(p.name)]));
const byProvinceAndName = new Map();
const byName = new Map();
const metroManila = new Map();
for (const city of cities) {
  const name = normalise(city.name);
  if (city.regionCode === "130000000") metroManila.set(name, city);
  if (city.provinceCode) byProvinceAndName.set(`${provinceName.get(city.provinceCode)}|${name}`, city);
  byName.set(name, [...(byName.get(name) ?? []), city]);
}

const zips = new Map();
let matched = 0;
const unmatched = [];
for (const [, zip, place, region, , province, , cityName] of rows) {
  // Metro Manila's rows are neighbourhoods: the city is in admin3 ("City of Makati"), and
  // the Capital District's rows have none but are all the City of Manila.
  const name = normalise(cityName || (province === "Capital District" ? "City of Manila" : place));
  // Province first; a name that is unique across the country also counts (Metro Manila's
  // cities have no province, and GeoNames' province names don't always match the PSA's).
  const city =
    region === "Metro Manila"
      ? metroManila.get(name)
      : (byProvinceAndName.get(`${normalise(province)}|${name}`) ??
        (byName.get(name)?.length === 1 ? byName.get(name)[0] : undefined));
  if (!city) {
    unmatched.push(`${zip} ${place} (${province})`);
    continue;
  }
  matched++;
  zips.set(city.code, [...new Set([...(zips.get(city.code) ?? []), zip])].sort());
}

const byNameSort = (a, b) => a.name.localeCompare(b.name);

// A region under both its names, so either finds it: PSGC calls some only by an acronym
// ("NCR", with "National Capital Region" as the other name) and numbers the rest
// ("Central Visayas", "Region VII"). Metro Manila is what people call NCR.
function regionLabel({ name, regionName }) {
  if (!regionName || regionName === name) return name;
  if (/^Region /.test(regionName)) return `${name} (${regionName})`;
  const label = `${regionName} (${name})`;
  return name === "NCR" ? label.replace(")", ", Metro Manila)") : label;
}
const data = {
  source: {
    psgc: "Philippine Standard Geographic Code, Philippine Statistics Authority (via psgc.gitlab.io)",
    zip: "GeoNames postal codes, CC BY 4.0 (geonames.org)",
    built: new Date().toISOString().slice(0, 10),
  },
  regions: regions.map((r) => ({ code: r.code, name: regionLabel(r) })).sort(byNameSort),
  provinces: provinces.map((p) => ({ code: p.code, name: p.name, region: p.regionCode })).sort(byNameSort),
  cities: cities
    .map((c) => ({
      code: c.code,
      name: c.name,
      province: c.provinceCode || null,
      region: c.regionCode,
      zips: zips.get(c.code) ?? [],
    }))
    .sort(byNameSort),
};

await writeFile(OUT, `${JSON.stringify(data)}\n`);
const withZip = data.cities.filter((c) => c.zips.length).length;
console.log(
  `${data.regions.length} regions, ${data.provinces.length} provinces, ${data.cities.length} cities; ` +
    `ZIP rows matched ${matched}/${rows.length}, cities with a ZIP ${withZip}/${data.cities.length}`,
);
if (process.env.VERBOSE) console.log(unmatched.join("\n"));
