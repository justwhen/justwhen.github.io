# personal-site

Static personal website: plain HTML/CSS/JS, no build step.
Live at **https://justwhen.github.io** (GitHub Pages, `main` branch, root).

```
index.html                   page content (edit text here)
assets/css/style.css         styles (colors in :root)
assets/js/jellyfish.js       ASCII jellyfish in the hero (tweak CONFIG at the top)
assets/js/typewriter.js      "I am…" role phrases under the name
assets/js/aquarium.js        isometric aquarium section map
assets/js/totop.js           floating back-to-top bubble
assets/Justin_Nguyen_CV.pdf  CV behind the "Download CV" button
```

## Preview locally

```
python -m http.server 8000
```

then open http://localhost:8000.

## Update the live site

Commit and push to `main`; GitHub Pages rebuilds automatically within about a minute.
When you change CSS or JS, bump the `?v=` number on its `<link>`/`<script>` tag in
`index.html` so browsers fetch the new file.

To refresh the CV, export the updated document to PDF and replace
`assets/Justin_Nguyen_CV.pdf` (keep personal contact details you don't want public out of it).
