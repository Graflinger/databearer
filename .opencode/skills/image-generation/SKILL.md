---
name: image-generation
description: Guides databearer blog image generation with Azure MAI/FLUX, generated-images outputs, and wiring images into frontend blog post frontmatter.
compatibility: opencode
metadata:
  project: databearer
  area: image-generation
---

# Databearer image generation skill

## When to use this skill

Use this skill when the user asks to generate, regenerate, test, or wire blog
card/header images, especially for files under:

- `image-generation/`
- `generated-images/`
- `frontend/src/images/blog_card_images/`
- `frontend/src/posts/<year>/*.md` image frontmatter

If the user also asks to edit a blog post, combine this with the
`frontend-page` skill.

## Current working setup

Primary provider:

- Provider adapter: `azure_mai_images`
- Model: `MAI-Image-2.5`
- Auth mode: `azure_cli`
- Endpoint route: `/mai/v1/images/generations?api-version=preview`

Tracked blog card images are expected to be `1408x800`. Azure MAI rejects
native `1408x800` because it exceeds the max pixel count. Generate at the
supported near-16:9 size:

```bash
--width 1366 --height 768
```

The service may normalize the saved PNG to `1360x768`. After generation,
resize/crop to `1408x800` before wiring into the frontend.

## Generate a blog image

Run commands from `image-generation/`:

```bash
python generate.py \
  --provider azure_mai_images \
  --auth-mode azure_cli \
  --model MAI-Image-2.5 \
  --width 1366 \
  --height 768 \
  --prompt "Full-bleed editorial blog card illustration, no border, no margin, no white bar, no text, no logos, wide 16:9 composition" \
  --out my-post-image
```

The image is written to:

```text
generated-images/my-post-image.png
```

Resize/crop the generated image to the frontend standard:

```bash
python - <<'PY'
from pathlib import Path
from PIL import Image

src = Path('../generated-images/my-post-image.png')
dst = Path('../generated-images/my-post-image-1408x800.png')
target_w, target_h = 1408, 800

with Image.open(src) as img:
    img = img.convert('RGB')
    scale = max(target_w / img.width, target_h / img.height)
    resized = img.resize(
        (round(img.width * scale), round(img.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    resized.crop((left, top, left + target_w, top + target_h)).save(dst)
print(dst)
PY
```

If auth fails, check:

```bash
az account show
```

If not logged in, ask the user to run:

```bash
az login
```

Do not ask the user to paste API keys into chat. If a key appears in chat,
recommend rotating it.

## Wire image into the frontend

1. Copy the resized `1408x800` image to the year-specific frontend image folder:

   ```bash
   cp ../generated-images/my-post-image-1408x800.png \
      ../frontend/src/images/blog_card_images/<year>/my-post-image.png
   ```

2. Update the post frontmatter:

   ```yaml
   image: "/images/blog_card_images/<year>/my-post-image.png"
   imageText: "Short descriptive image caption"
   ```

3. Verify the copied image:

   ```bash
   python - <<'PY'
   from pathlib import Path
   from PIL import Image
   path = Path('../frontend/src/images/blog_card_images/<year>/my-post-image.png')
   print(path.exists(), path.stat().st_size)
   with Image.open(path) as img:
       print(img.format, img.size, img.mode)
   PY
   ```

4. Run the frontend build from `frontend/`:

   ```bash
   npm run build
   ```

## Prompt guidance

- Default to a natural image that matches the post's topic and overall
  sentiment. Do **not** add numbers, charts, graphs, dashboards, documents,
  data overlays, or abstract data-visual metaphors unless the user explicitly
  asks for them.
- Use visual mood to reflect the story: positive results should get an
  optimistic/bright image; negative or critical posts should get a more sober
  tone.
- Ask for editorial/blog-card style, realistic or lightly polished unless the
  user requests abstraction.
- Include the post's subject and the intended mood.
- Always include `no text, no logos, no numbers, no charts, no diagrams, no
  documents, no data visualizations` unless those elements are explicitly
  requested.
- Always include `full-bleed`, `image content must fill the entire frame edge
  to edge`, `no border`, `no margin`, `no padding`, `no white bar`, and `no
  empty band at the bottom` for blog card images.
- Use `wide 16:9 composition` for blog card images.
- For data-journalism posts, avoid literal data visuals by default. Use the
  underlying real-world subject instead, for example wind turbines for wind
  power, factories for industry, rivers/cooling towers for nuclear heat stress,
  or city/landscape scenes for economic topics.

Example prompt for wind-power auction posts:

```text
Editorial blog card illustration for a German data journalism article about
wind power auctions with positive results: beautiful modern onshore wind
turbines in a sunny German countryside landscape, blue sky, soft warm light,
green fields, clean renewable energy atmosphere, calm and hopeful mood,
realistic but slightly polished journalistic style, wide 16:9 composition,
full-bleed image content filling the entire frame edge to edge, no border, no
margin, no padding, no white bar, no empty band at the bottom, no text, no
logos, no numbers, no charts, no diagrams, no documents, no data visualizations
```
