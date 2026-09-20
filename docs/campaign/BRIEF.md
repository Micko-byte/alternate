# VAA ALTERNATE — the try-on comparison ad

Everything a design session needs is in this folder. Point the session at this repo and tell it to read
this file; the pictures sit in `docs/campaign/assets/`.

---

## What VAA ALTERNATE is

A virtual fitting room built in Nairobi. A shopper adds one photo of themselves, screenshots any piece
from Instagram, TikTok or Pinterest, pays **KES 25 on M-Pesa**, and about a minute later sees that piece
drawn on their own body at its real size. Two try-ons for KES 50. Payment comes first; nothing is free.
Live at vaaalternate.lol.

## The one claim, and the proof for it

**A free AI does poor work. A paid AI does beautiful work and still changes the person. VAA ALTERNATE changes
the clothes and nothing else.**

Same woman, same dress, three machines. Every asset below is real, none of it is a mockup, and every
difference named here is visible when you open the files side by side.

| File | What it is | What to see in it |
|---|---|---|
| `01-her-photo.jpg` | Her real photo | Plain wall, white tee, jeans, **white Air Force sneakers**, arms down, weight even. This is the truth everything else is measured against. |
| `02-the-dress.jpg` | The real piece, laid flat | Mustard-and-white ditsy floral, thin ruffled straps, side slit. Flat on the floor it looks long — **it is a mini dress**. The shop listing says mini. |
| `03-free-ai-gemini.jpg` | A **free** AI's attempt | Kept her sneakers, but drew the dress as a **midi** — past the knee, nothing like the mini it was given. Her body is narrowed and her face is softened. |
| `04-paid-chatgpt.jpg` | **Paid ChatGPT's** attempt | Genuinely good-looking, and still wrong: it put her in **strappy white heels she does not own**, changed how she is standing, and reshaped her bust and waist. |
| `05-alternate.jpg` | **VAA ALTERNATE's** result | The mini, at the right length, on her own body. Her sneakers, her stance, her face, her hair, her proportions — untouched. |
| `06-feet-her.jpg`, `07-feet-paid-chatgpt.jpg`, `08-feet-alternate.jpg` | The same crop of the feet in all three | Sneakers → invented heels → the same sneakers. The clearest single proof in the whole set. |
| `09-free-ai-prompt-screenshot.jpg` | The free tool being asked | The prompt reads "help me try on this mini dress", with both pictures attached. It was told *mini* and still got it wrong. |

**Do not use the tattoo angle.** An earlier ChatGPT render invented a tattoo on her arm; that idea is
dropped. Length, shoes, posture and body shape are the story.

## The ad to make

Instagram and TikTok. **Each slide is a complete ad on its own** — someone who sees only slide three must
still understand what is being sold. Not a carousel where the meaning arrives at the end.

- **Full-bleed images.** The photo fills the frame; type sits on the picture. No white cards, no framed
  thumbnails floating in a layout.
- 1080 × 1350 for the feed, plus a 1080 × 1920 cut for stories and TikTok.
- Big type, few words, short sentences. Read it as if to someone who is not a heavy phone user.

### The order

1. **Her photo.** "This is her photo. Nothing else." — `01-her-photo.jpg`
2. **The free AI.** "We asked a free AI to put this dress on her." → it drew a completely different
   length. "It was told mini. It made a midi." — `03-free-ai-gemini.jpg`
3. **Paid ChatGPT.** "Then we paid for the good one." → "Beautiful picture. Look at the feet: those heels
   are not hers." — `04-paid-chatgpt.jpg`, and the feet crop `07`
4. **VAA ALTERNATE.** "We only change the clothes." → "Her shoes. Her stand. Her body. Her face." —
   `05-alternate.jpg`
5. **How to use it.** One photo → screenshot any dress → pay KES 25 on M-Pesa → see it in a minute.

### The voice: tell it as one person's story

The strongest version is first person, the way someone actually talks about shopping online:

> I saw this dress on Instagram. The post said it is a mini.
> I wanted to know how it would look on me before I send anyone money.
> I tried a free AI — it gave me the wrong dress, past my knee.
> I tried the paid one — beautiful picture, but it put me in heels I do not own and changed how I stand.
> Then I tried VAA ALTERNATE. Same me. Same shoes. Just the dress.
> KES 25 on M-Pesa. Two for KES 50.

Use that as the caption, and pull one line from it onto each slide.

## Who it is for

Kenyans who shop from Instagram, TikTok and WhatsApp sellers, and who cannot try anything on before
sending the M-Pesa. Plenty of them are already playing with AI profile pictures, so the idea of putting
your photo into a machine is familiar — what is new is that this one leaves *you* alone. Write for
someone reading on a cheap phone in poor light: plain words, no marketing English, no jargon, nothing
that needs a second read. Kenyan English as people write it; no forced Sheng, no American slang.

This is a **two-day test run**, evening to Monday morning, to see whether people can use the product at
all. Confidence, not hype.

## Brand

| Token | Value |
|---|---|
| Ink | `#191710` |
| Paper | `#F3F1EC` |
| Navy | `#222A41` |
| Mustard | `#DBAE49` |
| Muted | `#5C5A53` |
| Rule | `#DCD8CE` |

Heavy geometric display face for headlines; a mono face in small caps with wide letter-spacing for
labels; plain sans for body. Hard square corners, hairline rules, one mustard accent per composition.
The live site's tokens are in `src/index.css` and its voice is in `src/pages/Landing.tsx`.

## Rules

- Numbers come from this file only: KES 25 a try-on, 2 for KES 50, M-Pesa, Nairobi, about a minute.
- No invented testimonials, follower counts or accuracy percentages.
- Name no competitor product in the artwork — "a free AI" and "a paid AI" are enough. Their outputs may
  be shown; label plainly which picture came from where.
- The woman in these photos is a real person: nothing about her body, and no suggestion she endorses us.
- Say "her photo", never "your data".
