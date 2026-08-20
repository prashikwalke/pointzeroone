# pointzeroone.ai

a five-page static site. no build step, no dependencies — open `index.html` in a browser, or drop the whole folder into a Replit static site and it runs.

## files

| file | what it is |
|---|---|
| `index.html` | landing page — the invitation, the idea, four doors |
| `letter.html` | the 0.01 letter |
| `drawings.html` | drawings |
| `apps.html` | bookloop, tasteloop, and what's next |
| `book.html` | palette of wisdom |
| `style.css` | the whole design system — paper, ink, type, painted components |
| `app.js` | the brush engine — filters, stroke library, scroll motion, nav state |

## the brush

a stroke is not a line of constant width — it's a ribbon that swells where the brush pressed and thins where it lifted. so `app.js` treats every `.ink` path as a centreline: it samples along the length, wavers it with smooth low-frequency noise, applies a pressure profile (lands, holds, lifts off to a point), then offsets each sample perpendicular to build the outline — with independent tremor on the two edges so the sides never run parallel. that last part is what reads as bristle.

the result is emitted as bezier curves and filled. taper, swell and ragged edge are all geometry, so nothing rasterises: sharp at any zoom, any screen density, and clean in print.

clean geometry in the html is fine — `rect`, `circle`, `ellipse` and `line` are converted to paths automatically. authoring stays simple; the hand is applied afterward.

strokes marked `draw` are masked by their own centreline, so revealing the mask makes the ribbon appear to be painted on rather than wiped in.

use these classes:

- `class="ink"` — a painted stroke. add `ink-thin` or `ink-fat` for weight, `ink-clay` / `ink-sage` / `ink-gold` for colour
- `class="ink-solid"` — a filled painted shape
- `data-rough="0.8"` — override how much a mark wavers, in that svg's own units. left off, it scales with the viewBox
- `filter="url(#wash)"` — soft blurred colour for background shapes (the one filter still in use; a plain blur, no displacement)
- `class="draw"` — the stroke paints itself in on scroll (add `slow` for long strokes)

three helpers get injected automatically:

- `<div class="brush-rule"></div>` — a full-width painted divider. `data-mark="0..2"` picks the stroke
- `<h2 data-sweep="220">` — a painted sweep under a heading. `data-mark="0..3"` picks the shape, `data-tone="sage|gold|ink"` picks the colour
- `<div class="flecks" data-seed="7" data-n="12"></div>` — scattered ink flecks
- `<div class="wash" data-colour="var(--clay-soft)" style="..."></div>` — a soft colour wash, positioned with inline styles

## photographs

drop images in `drawings/` and reference them from a tile:

```html
<article class="tile">
  <div class="tile-art photo tall">
    <img src="drawings/name.jpeg" alt="short description" loading="lazy">
  </div>
  <div class="tile-body">
    <h3>title</h3>
    <p>one line about it.</p>
  </div>
</article>
```

photos are mounted whole on paper, never cropped — `object-fit: contain` inside a 4:5 frame with a paper margin, so the work reads as a print on a mount. clicking any photo opens it full size over the page; the caption is pulled from that tile's `h3` and `p`, so there's nothing extra to write. escape or a click on the background closes it. the tile is keyboard-reachable too.

## to fill in

- substack, x and youtube links are `#` placeholders in every footer
- the app store link on `apps.html` is a placeholder
- the drawing tiles use my line art as stand-ins — swap in real scans
- `letter.html` archive lists one real letter and three placeholders
