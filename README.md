# vaibhav3716.github.io

Personal academic website of Vaibhav Yenare, served by GitHub Pages at
https://vaibhav3716.github.io/

Plain HTML, CSS and JavaScript. There is no build step: edit a file, push, and the site updates within a minute or two.

## Where things live

| What | File |
|---|---|
| All page text (research, teaching, publications, contact) | `index.html` |
| Colours, fonts, layout | `assets/css/site.css` (colour tokens are at the top) |
| Hero sky (sunrise and night sky over Mumbai) | `assets/js/sky.js` |
| SED explorer, theme switch, scroll effects, blog feed | `assets/js/site.js` |
| Portrait | `assets/img/portrait.jpg` and `assets/img/portrait.webp` |
| Paper figures | `assets/img/research/` |
| Stargazing photos | `assets/img/stargazing/` |
| Andromeda quote background | `assets/img/andromeda-hst.webp` |
| CV | `files/Vaibhav_Yenare_CV.pdf` |

## Common updates

- **New CV:** replace `files/Vaibhav_Yenare_CV.pdf`, keeping the same file name.
- **Paper submitted or published:** edit the two entries under `id="publications"` in `index.html`,
  and the `paper-card` block in the research section. Add the arXiv or DOI link there.
- **Quotes:** each quote is a `<figure class="interlude">` block in `index.html`; copy one to add more.
- **New stargazing photo:** convert it to WebP, put it in `assets/img/stargazing/`, and copy a `<figure class="g-item">` block.
- **New blog post:** nothing to do. The "From the blog" list loads the three newest posts from Blogger.
- **New figure:** export it to WebP (for example `magick figure.pdf -density 200 -resize 1600x figure.webp`),
  put it in `assets/img/research/`, and copy one of the `<figure class="fig">` blocks.

## Preview locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.
