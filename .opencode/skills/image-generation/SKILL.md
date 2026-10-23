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
  --prompt "Blog card illustration of <scene>, comfy realistic anime style, hand-painted anime background art, soft warm light, full-bleed, no border, no margin, no white bar, no text, no logos, wide 16:9 composition" \
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
   imageAlt: "Description of what the image shows" # empty only if decorative
   imageText: "Visible editorial image caption (KI-generiert)"
   # socialImage: "/images/blog_card_images/<year>/my-post-social.png"
   # socialImageAlt: "Description of the social preview image"
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

4. Run the [checks](../../../docs/seo.md#checks) from `frontend/`:
   `npm test -- --runInBand`, `npm run lint`, `npm run build`,
   `npm run test:seo-output`. Inspect the hero and card rendering on mobile and
   desktop. Checks do not authorize publication or deployment.

### Responsive delivery and metadata (summary)

The details are in [Images](../../../docs/seo.md#images). In short:

- Keep the curated source under `frontend/src/images/`, and reference it as a local
  `/images/...` path with the exact letter case. A wrong path or case fails the build
  with a clear `Image not found` error. Unused files are never processed.
- The build creates WebP plus JPEG/PNG variants in the ignored
  `_site/assets/images/`. Never commit them or hand-write their hashed URLs.
- Every article image is AI-generated, so the visible caption `imageText` ends with
  ` (KI-generiert)`: "Große Speicher prägen den Batterieausbau (KI-generiert)". No
  "KI-generiertes Symbolbild:" prefix and no period before the parenthesis.
  The caption says what the image stands for; `imageAlt` describes what it shows.
- Cards are decorative. `imageAlt` (and optional `socialImageAlt` for a separate
  `socialImage`) should describe the image, not repeat the caption. When no alt is
  set, `og:image:alt` is omitted. Pages without an image use the brand preview with
  alt `Databearer-Logo`.
- Image generation with Azure is a separate authoring step. The frontend build never
  fetches images. JSON Feed keeps the original `image` URL, and `_image_alt` there is
  `imageText` ([Feeds](../../../docs/seo.md#feeds)).

## Prompt guidance

### House style: comfy realistic anime

Every Databearer card image uses the same default look: **comfy realistic anime
style**. Only deviate if the user explicitly asks for another style for a post.

- Hand-painted anime look with realistic proportions, believable architecture,
  landscapes and technology (in the spirit of modern anime films' background art),
  not chibi, not exaggerated characters, not photorealistic, not 3D render.
- Comfy, calm atmosphere: soft warm light, gentle colours, cosy everyday details,
  lots of sky and nature where it fits.
- People are optional and small in the scene; the subject is the place or the
  technology, not a character portrait.
- Always put this style phrase into the prompt:
  `comfy realistic anime style, hand-painted anime background art, realistic
  proportions and details, soft warm light, calm cosy atmosphere`.

### Content and mood

- Default to a scene that matches the post's topic and overall sentiment. Do
  **not** add numbers, charts, graphs, dashboards, documents, data overlays, or
  abstract data-visual metaphors unless the user explicitly asks for them.
- For data-journalism posts, show the underlying real-world subject instead, for
  example wind turbines for wind power, factories for industry, rivers/cooling
  towers for nuclear heat stress, or city/landscape scenes for economic topics.
  Prefer recognisably German/Central European settings.
- Use visual mood to reflect the story within the comfy style: positive results
  get bright, warm, hopeful light; negative or critical posts get a quieter,
  more overcast or dusky tone, but stay calm rather than dramatic.
- Include the post's subject and the intended mood.

### Always include

- `no text, no logos, no numbers, no charts, no diagrams, no documents, no data
  visualizations` unless those elements are explicitly requested.
- `full-bleed`, `image content must fill the entire frame edge to edge`,
  `no border`, `no margin`, `no padding`, `no white bar`, and `no empty band at
  the bottom`.
- `wide 16:9 composition`.

### Prompt template

```text
Blog card illustration for a German data journalism article about <topic> with
<positive/neutral/critical> findings: <scene with the real-world subject>,
<setting, time of day, light>, <mood>, comfy realistic anime style, hand-painted
anime background art, realistic proportions and details, soft warm light, calm
cosy atmosphere, wide 16:9 composition, full-bleed image content filling the
entire frame edge to edge, no border, no margin, no padding, no white bar, no
empty band at the bottom, no text, no logos, no numbers, no charts, no diagrams,
no documents, no data visualizations
```

Example prompt for wind-power auction posts:

```text
Blog card illustration for a German data journalism article about wind power
auctions with positive results: modern onshore wind turbines on gentle hills in
the German countryside, green fields and a small village with red roofs, blue sky
with soft summer clouds, late afternoon light, calm and hopeful mood, comfy
realistic anime style, hand-painted anime background art, realistic proportions
and details, soft warm light, calm cosy atmosphere, wide 16:9 composition,
full-bleed image content filling the entire frame edge to edge, no border, no
margin, no padding, no white bar, no empty band at the bottom, no text, no logos,
no numbers, no charts, no diagrams, no documents, no data visualizations
```
