# Prompt for Claude — the fit campaign

For a Claude session that has this repo open. Attach the photos and the screen recording, then paste
everything below the line.

---

You have the ALTERNATE codebase open. ALTERNATE is a virtual fitting room built in Nairobi: a shopper
adds their photo once, then sees any piece drawn onto their own body, in their own size, checked before
they see it. A try-on costs KES 25, two for KES 50, paid by M-Pesa. Stores list free and earn a cut of
what their followers spend. Read `src/index.css` for the brand tokens, `src/pages/Landing.tsx` for the
voice and the layout language, and `docs/IMAGE_GUIDE.md` for how photography is treated here.

Build a campaign around one claim we can prove with pictures: **a general AI tool changes the clothes
and the body. Ours keeps both.**

## The argument — this is the whole campaign

A shopper's question is never "does this look nice", it is **"will it fit me"**. That is what the free
tools get wrong. Given a real garment and a real photo, they redraw the piece as a rough idea of itself
and quietly reshape the person around it:

- the dress comes out **bigger and looser** than the real piece
- the **waist is wrong** — nipped or widened to suit the drawing, not the body
- the silhouette drifts: length, drape and where the fabric actually falls
- the face and skin can shift too. In one of our tests it drew a **tattoo on an arm that has none** —
  a small thing, but it proves the tool is inventing rather than fitting

ALTERNATE reads the real measurements of the piece, reads the shopper's body from their own photos, and
draws the piece at its true size on them — which is the only version of this that is worth paying for.
Getting the size right is the product. The invented tattoo is a footnote, not the headline.

## Assets

- `her-photo` — the shopper's real photo: plain wall, white tee, jeans, arms down, phone at chest
  height. This is the truth everything is measured against.
- `the-dress` — the real piece: a mustard-and-white ditsy floral **maxi** with a thigh-high slit, on a
  hanger. Note the cut: fitted through the waist, long to the floor.
- `chatgpt-result` — what a general AI tool produced from those two inputs. Compare it to the hanger
  shot and to her photo, and measure by eye: waist, hip, where the hem lands, how much room is in the
  bodice, the strap, the slit, the print scale, her arm.
- `alternate-result` — ours, when it arrives. If it is not attached yet, design the layouts with a
  clearly marked placeholder and tell me exactly what frame you need.
- A screen recording of the other tool's session, for the video cut.

Work from what you can actually see in the files. Every difference you name in the campaign must be
visible when someone looks. Do not invent percentages, and do not claim a difference you cannot point
at.

## What to make

1. **The line** — three options, one recommended, each under seven words, all about fit rather than
   technology.
2. **The comparison graphic** — phone-shaped, the two results side by side, with the size differences
   called out where they happen: waist, hem, bodice. It must read at thumbnail size in a feed.
3. **Three posts** (1080×1350), one idea each: the waist, the length, the price. Captions of 20–40
   words, first line working as the preview, Kenyan English as people actually write it.
4. **A 15-second vertical cut** — shot list with on-screen text and timings, using the recording for
   the "what the free tool did" beat and the real photos for the payoff.
5. **A landing-page section**, written as real code in this repo's style: brand tokens from
   `src/index.css`, the layout language of `src/pages/Landing.tsx`, responsive from 375px, light and
   dark, with a caption that says plainly which picture came from where. Run the dev server and show me
   it rendered before you call it done.
6. **One line of legal-safe wording**, since we are showing another company's output.

## Rules

- Numbers come from this brief only: KES 25 a try-on, 2 for KES 50, M-Pesa, Nairobi.
- No invented testimonials, follower counts or accuracy figures.
- Never mock the shopper for using free tools, and do not name-call the other product — show its output.
- The woman in these photos is a real person: nothing about her body, and no suggestion she endorses us.
- Say "her photo", never "your data"; say what the product does, not what the model is.
