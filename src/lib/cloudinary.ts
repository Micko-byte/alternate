// Marketing photos live on Cloudinary (cloud dnrj0hbpy, folder ALTERNATE/). Cloudinary picks the best format
// (WebP/AVIF), compresses, and serves a smaller copy to phones through srcset.
const BASE = "https://res.cloudinary.com/dnrj0hbpy/image/upload";
const WIDTHS = [400, 640, 900, 1200];

/** URL for one width. c_limit never enlarges a small original. */
export function cloudinaryUrl(id: string, width: number) {
  return `${BASE}/f_auto,q_auto,c_limit,w_${width}/ALTERNATE/${id}`;
}

/** src, srcSet and sizes for an <img>, so phones download a phone-sized copy. */
export function cloudinaryImage(id: string, sizes: string) {
  return {
    src: cloudinaryUrl(id, 900),
    srcSet: WIDTHS.map((w) => `${cloudinaryUrl(id, w)} ${w}w`).join(", "),
    sizes,
  };
}
