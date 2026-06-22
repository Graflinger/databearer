# Image generation

This folder contains a thin notebook and CLI for generating blog card/header
images. The implementation is provider-adaptable, so switching models or API
shapes should usually only require changing config or adding a small adapter in
`image_generator.py`.

## CLI usage

```bash
python generate.py \
  --provider azure_flux \
  --model FLUX.2-pro \
  --prompt "wide editorial illustration, no text" \
  --out my-blog-image
```

Generated images are written to `IMAGE_OUTPUT_DIR`, defaulting to
`../generated-images`.

Azure AI Foundry example:

```bash
export IMAGE_GENERATION_ENDPOINT_URL="https://<resource>.services.ai.azure.com/models"
export IMAGE_GENERATION_KEY="<key>"
python generate.py \
  --provider azure_mai_images \
  --auth-mode azure_cli \
  --model MAI-Image-2.5 \
  --prompt "wide editorial illustration, no text" \
  --out my-blog-image
```

If key-based auth is enabled for the resource, use `--auth-mode api_key` and
set `IMAGE_GENERATION_KEY`. If key-based auth is disabled, run `az login` and
use `--auth-mode azure_cli`.

## Configuration

Preferred generic environment variables:

- `IMAGE_GENERATION_ENDPOINT_URL`
- `IMAGE_GENERATION_KEY`
- `IMAGE_GENERATION_MODEL`
- `IMAGE_GENERATION_PROVIDER`
- `IMAGE_GENERATION_AUTH_MODE`
- `IMAGE_GENERATION_HEADER_NAME`
- `IMAGE_GENERATION_HEADER_VALUE_PREFIX`
- `IMAGE_GENERATION_ENDPOINT_PATH`
- `IMAGE_OUTPUT_DIR`

Current FLUX-specific names are still supported for backwards compatibility:

- `AZURE_FLUX_GENERATION_URL`
- `AZURE_FLUX_API_KEY`
- `fluxkey`

## Providers

Current adapters:

- `azure_flux` — current default; sends `prompt`, `model`, `width`, `height`,
  `output_format`, and expects `data[0].b64_json` or `data[0].url`.
- `openai_style` — same request/response shape as `azure_flux`, but named more
  generically for compatible endpoints.
- `openai_images` — sends a common OpenAI Images-style body with `size` and
  `response_format`.
- `azure_foundry_images` — treats `IMAGE_GENERATION_ENDPOINT_URL` as a Foundry
  base URL such as `https://<resource>.services.ai.azure.com/models` and appends
  `images/generations?api-version=2025-04-01-preview` by default. Override the
  suffix with `IMAGE_GENERATION_ENDPOINT_PATH` if the deployed model uses a
  different route.
- `azure_mai_images` — uses the MAI image route from Azure's curl examples:
  `/mai/v1/images/generations?api-version=preview`; request body contains
  `prompt`, `width`, `height`, `n`, and `model`.

To support a provider with a different request or response shape, add a new
`ImageGenerationAdapter` in `image_generator.py`.
