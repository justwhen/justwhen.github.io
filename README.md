# personal-site

Static personal website: plain HTML/CSS/JS, no build step.

```
index.html                 page content (edit text here)
assets/css/style.css       styles (colors in :root)
assets/js/jellyfish.js     procedural ASCII jellyfish (tweak CONFIG at the top)
assets/Justin_Nguyen_CV.pdf  ← add this (export your CV to PDF)
```

## Preview locally

```
python -m http.server 8000
```

then open http://localhost:8000.

## To-dos

- Export CV to `assets/Justin_Nguyen_CV.pdf` (the "Download CV" button links there).
- Fill in Google Scholar / ORCID / GitHub / LinkedIn links in the footer (`href="#"`).
- Confirm the tools listed under "Data & statistics" (e.g. add R / Python / Seurat / Scanpy).

## Deploy (GitHub Pages)

1. Create a repo (e.g. `<username>.github.io` for a root URL) and push this folder.
2. Repo → Settings → Pages → Source: *Deploy from a branch* → `main` / root.
