# vaibhav3716.github.io

Personal academic website of Vaibhav Yenare, served by GitHub Pages at
https://vaibhav3716.github.io/

Plain HTML, CSS and JavaScript. There is no build step: edit a file, push, and the site updates within a minute or two.

## Where things live

| What | File |
|---|---|
| All page text (research, teaching, publications, contact) | `index.html` |
| Colours, fonts, layout | `assets/css/site.css` (colour tokens are at the top) |
| Theme chosen from day or night where the visitor is | `assets/js/daynight.js` |
| Live hero sky (Mumbai at night, the opposite side of Earth by day) | `assets/js/sky.js` |
| Star catalogue for the sky | `assets/data/sky-data.json` (from d3-celestial, BSD licence) |
| SED explorer, theme switch, scroll effects, page star field, blog feed | `assets/js/site.js` |
| Smooth scrolling | `assets/js/vendor/lenis.min.js` (Lenis, MIT licence, see `lenis-LICENSE.txt`) |
| Tool logos | `assets/img/logos/` (Simple Icons, CC0; Astropy logo CC BY-SA 3.0) |
| Portrait | `assets/img/portrait.jpg` and `assets/img/portrait.webp` |
| About: portrait with engraved orbiting planets | `assets/js/orbits.js` |
| Paper figures | `assets/img/research/` |
| Stargazing photos | `assets/img/stargazing/` |
| Quote backgrounds (ESA/Hubble, ESA/Webb) | `assets/img/andromeda-hst.webp`, `assets/img/esa/` |
| CV | `files/Vaibhav_Yenare_CV.pdf` |

## Common updates

- **New CV:** replace `files/Vaibhav_Yenare_CV.pdf`, keeping the same file name.
- **Paper submitted or published:** edit the two entries under `id="publications"` in `index.html`,
  and the `paper-card` block in the research section. Add the arXiv or DOI link there.
- **Quotes:** each quote is a `<section class="quote-panel">` block in `index.html`. Copy one, point `--img` at a new image, and keep the credit line: ESA/Hubble and ESA/Webb images are CC BY 4.0 and must be credited.
- **New stargazing photo:** convert it to WebP, put it in `assets/img/stargazing/`, and copy a `<figure class="g-item">` block.
- **New blog post:** nothing to do. The "From the blog" list loads the three newest posts from Blogger.
- **New figure:** export it to WebP (for example `magick figure.pdf -density 200 -resize 1600x figure.webp`),
  put it in `assets/img/research/`, and copy one of the `<figure class="fig">` blocks.

## The live sky

`sky.js` computes the sky from the visitor's clock: star positions from the catalogue, the Sun, Moon and
planets from orbital elements (checked against NASA JPL Horizons), and Earth's rotation. Dark theme shows
wherever it is night right now; light theme wherever it is day (Mumbai or the point opposite it on Earth).
The view stays still until a visitor presses "Explore the sky"; then they can drag to look around and click
objects to identify them. They can also choose to see the sky above their own location. The location never leaves their browser.

## Day and night theme

`daynight.js` runs before the page is drawn. It works out where the visitor is from their time zone (or
from their location, if they have already let the site use it), computes the Sun's altitude there, and
picks the paper theme while the Sun is up and the dark theme after sunset. It switches by itself at sunrise
and sunset. If a visitor uses the theme switch, their choice holds until they close the tab.

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
