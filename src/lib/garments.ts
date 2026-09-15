// What can be tried on. The category decides which part of the photo changes and which size applies;
// the type (hoodie, blazer, quarter-zip…) tells the AI exactly what it is drawing.

export type GarmentGroup = "Clothing" | "Shoes & accessories";

export const GARMENTS: { category: string; label: string; group: GarmentGroup; types: string[] }[] = [
  { category: "top", label: "Top", group: "Clothing", types: ["T-shirt", "Shirt", "Blouse", "Polo", "Tank top", "Crop top", "Bodysuit", "Hoodie", "Sweatshirt", "Jumper", "Pullover", "Quarter-zip", "Cardigan", "Jersey"] },
  { category: "outerwear", label: "Jacket or coat", group: "Clothing", types: ["Blazer", "Denim jacket", "Leather jacket", "Bomber jacket", "Varsity jacket", "Puffer jacket", "Coat", "Trench coat", "Gilet", "Windbreaker"] },
  { category: "bottom", label: "Trousers", group: "Clothing", types: ["Jeans", "Trousers", "Wide-leg trousers", "Chinos", "Cargo trousers", "Joggers", "Shorts", "Leggings"] },
  { category: "skirt", label: "Skirt", group: "Clothing", types: ["Mini skirt", "Midi skirt", "Maxi skirt", "Pleated skirt", "Denim skirt", "Pencil skirt"] },
  { category: "dress", label: "Dress", group: "Clothing", types: ["Mini dress", "Midi dress", "Maxi dress", "Bodycon dress", "Shirt dress", "Slip dress", "Kitenge dress", "Gown"] },
  { category: "jumpsuit", label: "Jumpsuit", group: "Clothing", types: ["Jumpsuit", "Playsuit", "Overalls"] },
  { category: "set", label: "Set or suit", group: "Clothing", types: ["Co-ord set", "Suit", "Tracksuit", "Two-piece"] },
  { category: "shoes", label: "Shoes", group: "Shoes & accessories", types: ["Sneakers", "Heels", "Sandals", "Boots", "Loafers", "Flats", "Slides"] },
  { category: "eyewear", label: "Glasses", group: "Shoes & accessories", types: ["Sunglasses", "Glasses"] },
  { category: "headwear", label: "Hat", group: "Shoes & accessories", types: ["Cap", "Bucket hat", "Beanie", "Hat", "Headwrap", "Durag"] },
  { category: "jewellery", label: "Jewellery", group: "Shoes & accessories", types: ["Necklace", "Chain", "Earrings", "Bracelet", "Watch", "Rings"] },
];

export const GARMENT_BY_CATEGORY = Object.fromEntries(GARMENTS.map((g) => [g.category, g]));

/** Where an item ends on the body. Keys match the database and the try-on engine. */
const DRESS_LENGTHS = [
  { value: "upper_thigh", label: "Mini" },
  { value: "mid_thigh", label: "Short" },
  { value: "above_knee", label: "Above knee" },
  { value: "knee", label: "Knee" },
  { value: "below_knee", label: "Below knee" },
  { value: "mid_calf", label: "Midi" },
  { value: "ankle", label: "Maxi" },
  { value: "floor", label: "Floor" },
];
const TOP_LENGTHS = [
  { value: "cropped", label: "Cropped" },
  { value: "waist", label: "Waist" },
  { value: "high_hip", label: "High hip" },
  { value: "hip", label: "Hip" },
  { value: "mid_thigh", label: "Long" },
];
const COAT_LENGTHS = [...TOP_LENGTHS, { value: "knee", label: "Knee" }, { value: "mid_calf", label: "Calf" }, { value: "ankle", label: "Full length" }];
const BOTTOM_LENGTHS = [
  { value: "upper_thigh", label: "Short shorts" },
  { value: "above_knee", label: "Shorts" },
  { value: "knee", label: "Knee" },
  { value: "mid_calf", label: "Cropped" },
  { value: "ankle", label: "Ankle" },
  { value: "floor", label: "Full length" },
];

export const LENGTH_OPTIONS: Record<string, { value: string; label: string }[]> = {
  dress: DRESS_LENGTHS,
  skirt: DRESS_LENGTHS,
  set: DRESS_LENGTHS,
  jumpsuit: BOTTOM_LENGTHS,
  top: TOP_LENGTHS,
  outerwear: COAT_LENGTHS,
  bottom: BOTTOM_LENGTHS,
};

const ORDER = ["cropped", "waist", "high_hip", "hip", "upper_thigh", "mid_thigh", "above_knee", "knee", "below_knee", "mid_calf", "ankle", "floor"];

/** The closest option this category offers to a detected length. */
export function closestLength(category: string, detected: string | null | undefined) {
  const options = LENGTH_OPTIONS[category];
  if (!options || !detected || !ORDER.includes(detected)) return null;
  const i = ORDER.indexOf(detected);
  return options.reduce((best, o) => (Math.abs(ORDER.indexOf(o.value) - i) < Math.abs(ORDER.indexOf(best.value) - i) ? o : best), options[0]).value;
}

/** Categories that have a clothing size. */
export const SIZED_CATEGORIES = ["dress", "top", "bottom", "skirt", "jumpsuit", "outerwear"];
