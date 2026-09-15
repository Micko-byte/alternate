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

/** Categories that have a clothing size. */
export const SIZED_CATEGORIES = ["dress", "top", "bottom", "skirt", "jumpsuit", "outerwear"];
