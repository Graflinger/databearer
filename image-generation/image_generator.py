"""Provider-adaptable image generation helpers.

The notebook and CLI call :func:`generate_image`; provider-specific request and
response shapes are isolated in small adapters below. The default adapter keeps
the current Azure FLUX endpoint working, while future OpenAI-style image APIs
and Azure AI Foundry image endpoints can be selected with
``IMAGE_GENERATION_PROVIDER`` or ``--provider``.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Callable
from urllib.parse import urlsplit, urlunsplit

import requests
from dotenv import load_dotenv
from PIL import Image

# Resolve config relative to this file so cwd never matters.
_THIS_DIR = Path(__file__).resolve().parent

# Load .env sitting next to this module (no-op if it does not exist).
load_dotenv(_THIS_DIR / ".env")

DEFAULT_OUTPUT_DIR = _THIS_DIR.parent / "generated-images"
DEFAULT_WIDTH = 1408
DEFAULT_HEIGHT = 800
DEFAULT_OUTPUT_FORMAT = "png"
DEFAULT_MODEL = "FLUX.2-pro"
DEFAULT_PROVIDER = "azure_flux"
DEFAULT_AUTH_MODE = "api_key"
REQUEST_TIMEOUT_SECONDS = 120


@dataclass(frozen=True)
class RequestSpec:
    """HTTP request data produced by a provider adapter."""

    body: dict[str, object]
    endpoint_path: str = ""


@dataclass(frozen=True)
class ImagePayload:
    """Image payload extracted from a provider response."""

    kind: str
    data: str


@dataclass(frozen=True)
class ImageGenerationAdapter:
    """Provider-specific request/response conversion functions."""

    name: str
    build_request: Callable[[str, str, int, int, str], RequestSpec]
    extract_image: Callable[[dict[str, object]], ImagePayload]


@dataclass(frozen=True)
class ImageGenerationConfig:
    """Runtime config for an image generation request."""

    endpoint_url: str
    credential: str
    model: str = DEFAULT_MODEL
    provider: str = DEFAULT_PROVIDER
    auth_mode: str = DEFAULT_AUTH_MODE
    header_name: str = "api-key"
    header_value_prefix: str = ""
    output_dir: Path = DEFAULT_OUTPUT_DIR
    timeout_seconds: int = REQUEST_TIMEOUT_SECONDS


def _read_required_env(name: str, description: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(
            f"{name} is not set. Copy .env.example to .env and fill in {description}."
        )
    return value


def get_azure_cli_token(
    scope: str = "https://cognitiveservices.azure.com/.default",
) -> str:
    """Return an Entra token from the active Azure CLI login."""
    result = subprocess.run(
        ["az", "account", "get-access-token", "--scope", scope, "--output", "json"],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        message = (result.stderr or result.stdout).strip()
        raise RuntimeError(
            "Could not get an Azure CLI access token. Run `az login` first. "
            f"Azure CLI said: {message}"
        )

    payload = json.loads(result.stdout)
    return str(payload["accessToken"])


def resolve_output_dir() -> Path:
    """Resolve and create the output directory.

    Honours ``IMAGE_OUTPUT_DIR``; relative values are resolved against this
    module's directory so behaviour is stable regardless of cwd.
    """
    raw = os.getenv("IMAGE_OUTPUT_DIR")
    if raw:
        output_dir = Path(raw)
        if not output_dir.is_absolute():
            output_dir = (_THIS_DIR / output_dir).resolve()
    else:
        output_dir = DEFAULT_OUTPUT_DIR
    output_dir.mkdir(parents=True, exist_ok=True)
    return output_dir


def load_config(
    model: str | None = None,
    provider: str | None = None,
    auth_mode: str | None = None,
) -> ImageGenerationConfig:
    """Load image generation config from environment variables.

    Supported variables:
      - ``IMAGE_GENERATION_ENDPOINT_URL`` (preferred) or
        ``AZURE_FLUX_GENERATION_URL`` (legacy/current project name)
      - ``IMAGE_GENERATION_KEY`` (preferred), ``AZURE_FLUX_API_KEY`` or
        ``fluxkey`` (legacy/current project names)
      - ``IMAGE_GENERATION_MODEL`` (defaults to ``FLUX.2-pro``)
      - ``IMAGE_GENERATION_PROVIDER`` (defaults to ``azure_flux``)
      - ``IMAGE_GENERATION_AUTH_MODE`` (``api_key`` or ``azure_cli``)
      - ``IMAGE_GENERATION_HEADER_NAME`` (defaults to ``api-key``)
      - ``IMAGE_GENERATION_HEADER_VALUE_PREFIX`` (for example ``Bearer ``)
      - ``IMAGE_GENERATION_ENDPOINT_PATH`` (provider-specific URL suffix)
      - ``IMAGE_OUTPUT_DIR`` (defaults to ``../generated-images``)
    """
    endpoint_url = os.getenv("IMAGE_GENERATION_ENDPOINT_URL") or os.getenv(
        "AZURE_FLUX_GENERATION_URL"
    )
    if not endpoint_url:
        endpoint_url = _read_required_env(
            "IMAGE_GENERATION_ENDPOINT_URL", "the image generation endpoint URL"
        )

    resolved_auth_mode = auth_mode or os.getenv("IMAGE_GENERATION_AUTH_MODE", DEFAULT_AUTH_MODE)
    if resolved_auth_mode == "azure_cli":
        credential = get_azure_cli_token()
        header_name = "Authorization"
        header_value_prefix = "Bearer "
    elif resolved_auth_mode == "api_key":
        credential = (
            os.getenv("IMAGE_GENERATION_KEY")
            or os.getenv("AZURE_FLUX_API_KEY")
            or os.getenv("fluxkey")
        )
        if not credential:
            credential = _read_required_env(
                "IMAGE_GENERATION_KEY", "the image generation credential"
            )
        header_name = os.getenv("IMAGE_GENERATION_HEADER_NAME", "api-key")
        header_value_prefix = os.getenv("IMAGE_GENERATION_HEADER_VALUE_PREFIX", "")
    else:
        raise RuntimeError(
            "Unknown IMAGE_GENERATION_AUTH_MODE. Expected `api_key` or `azure_cli`."
        )

    return ImageGenerationConfig(
        endpoint_url=endpoint_url,
        credential=credential,
        model=model or os.getenv("IMAGE_GENERATION_MODEL", DEFAULT_MODEL),
        provider=provider or os.getenv("IMAGE_GENERATION_PROVIDER", DEFAULT_PROVIDER),
        auth_mode=resolved_auth_mode,
        header_name=header_name,
        header_value_prefix=header_value_prefix,
        output_dir=resolve_output_dir(),
    )


def decode_and_save_image(b64_data: str, output_path: Path) -> Image.Image:
    """Decode a base64 PNG/JPEG payload and write it to ``output_path``."""
    image = Image.open(BytesIO(base64.b64decode(b64_data)))
    image.save(output_path)
    return image


def download_and_save_image(url: str, output_path: Path, timeout_seconds: int) -> Image.Image:
    """Download an image URL and write it to ``output_path``."""
    response = requests.get(url, timeout=timeout_seconds)
    response.raise_for_status()
    image = Image.open(BytesIO(response.content))
    image.save(output_path)
    return image


def build_endpoint_url(base_url: str, endpoint_path: str) -> str:
    """Combine a configured endpoint URL with a provider endpoint path.

    If ``endpoint_path`` is empty, ``base_url`` is returned unchanged. Relative
    paths are appended to ``base_url``. Root-relative paths (starting with `/`)
    replace the path portion of ``base_url`` while preserving scheme/host. This
    lets users provide either a full request URL or a provider base URL such as
    the Azure AI Foundry ``.../models`` endpoint.
    """
    if not endpoint_path:
        return base_url
    if endpoint_path.startswith("/"):
        parts = urlsplit(base_url)
        path_and_query = urlsplit(endpoint_path)
        return urlunsplit(
            (
                parts.scheme,
                parts.netloc,
                path_and_query.path,
                path_and_query.query,
                path_and_query.fragment,
            )
        )
    return f"{base_url.rstrip('/')}/{endpoint_path.lstrip('/')}"


def save_image_payload(
    payload: ImagePayload,
    output_path: Path,
    timeout_seconds: int,
) -> Image.Image:
    """Persist a provider image payload to disk."""
    if payload.kind == "b64_json":
        return decode_and_save_image(payload.data, output_path)
    if payload.kind == "url":
        return download_and_save_image(payload.data, output_path, timeout_seconds)
    raise RuntimeError(f"Unsupported image payload kind: {payload.kind}")


def build_request_body(
    *,
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> dict[str, object]:
    """Build the OpenAI-style image generation request body."""
    return {
        "prompt": prompt,
        "n": 1,
        "width": width,
        "height": height,
        "output_format": output_format,
        "model": model,
    }


def build_openai_images_body(
    *,
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> dict[str, object]:
    """Build a common OpenAI Images API request body."""
    return {
        "prompt": prompt,
        "model": model,
        "n": 1,
        "size": f"{width}x{height}",
        "response_format": "b64_json",
        "output_format": output_format,
    }


def build_foundry_images_body(
    *,
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> dict[str, object]:
    """Build a conservative Azure AI Foundry image generation request body."""
    return {
        "prompt": prompt,
        "model": model,
        "n": 1,
        "size": f"{width}x{height}",
        "response_format": "b64_json",
        "output_format": output_format,
    }


def build_mai_images_body(
    *,
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> dict[str, object]:
    """Build an Azure MAI image generation request body."""
    return {
        "prompt": prompt,
        "width": width,
        "height": height,
        "n": 1,
        "model": model,
    }


def extract_image_payload(response_json: dict[str, object]) -> ImagePayload:
    """Extract the first image from common image generation response shapes."""
    if "b64_json" in response_json:
        return ImagePayload(kind="b64_json", data=str(response_json["b64_json"]))
    if "url" in response_json:
        return ImagePayload(kind="url", data=str(response_json["url"]))
    if "image" in response_json:
        return ImagePayload(kind="b64_json", data=str(response_json["image"]))

    data = response_json.get("data") or response_json.get("images")
    if not isinstance(data, list) or not data:
        raise RuntimeError("Image generation response did not include an image payload.")

    first_image = data[0]
    if not isinstance(first_image, dict):
        raise RuntimeError("Image generation response data[0] was not an object.")

    if "b64_json" in first_image:
        return ImagePayload(kind="b64_json", data=str(first_image["b64_json"]))
    if "url" in first_image:
        return ImagePayload(kind="url", data=str(first_image["url"]))
    if "image" in first_image:
        return ImagePayload(kind="b64_json", data=str(first_image["image"]))

    raise RuntimeError("Image generation response included neither b64_json, image, nor url.")


def extract_b64_image(response_json: dict[str, object]) -> str:
    """Extract the first base64 image from a data-array response payload."""
    payload = extract_image_payload(response_json)
    if payload.kind != "b64_json":
        raise RuntimeError("Image generation response did not include data[0].b64_json.")
    return payload.data


def _build_flux_request(
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> RequestSpec:
    return RequestSpec(
        body=build_request_body(
            prompt=prompt,
            model=model,
            width=width,
            height=height,
            output_format=output_format,
        )
    )


def _build_openai_images_request(
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> RequestSpec:
    return RequestSpec(
        body=build_openai_images_body(
            prompt=prompt,
            model=model,
            width=width,
            height=height,
            output_format=output_format,
        )
    )


def _build_foundry_images_request(
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> RequestSpec:
    endpoint_path = os.getenv(
        "IMAGE_GENERATION_ENDPOINT_PATH",
        "images/generations?api-version=2025-04-01-preview",
    )
    return RequestSpec(
        body=build_foundry_images_body(
            prompt=prompt,
            model=model,
            width=width,
            height=height,
            output_format=output_format,
        ),
        endpoint_path=endpoint_path,
    )


def _build_mai_images_request(
    prompt: str,
    model: str,
    width: int,
    height: int,
    output_format: str,
) -> RequestSpec:
    endpoint_path = os.getenv(
        "IMAGE_GENERATION_ENDPOINT_PATH",
        "/mai/v1/images/generations?api-version=preview",
    )
    return RequestSpec(
        body=build_mai_images_body(
            prompt=prompt,
            model=model,
            width=width,
            height=height,
            output_format=output_format,
        ),
        endpoint_path=endpoint_path,
    )


ADAPTERS: dict[str, ImageGenerationAdapter] = {
    "azure_flux": ImageGenerationAdapter(
        name="azure_flux",
        build_request=_build_flux_request,
        extract_image=extract_image_payload,
    ),
    "openai_style": ImageGenerationAdapter(
        name="openai_style",
        build_request=_build_flux_request,
        extract_image=extract_image_payload,
    ),
    "openai_images": ImageGenerationAdapter(
        name="openai_images",
        build_request=_build_openai_images_request,
        extract_image=extract_image_payload,
    ),
    "azure_foundry_images": ImageGenerationAdapter(
        name="azure_foundry_images",
        build_request=_build_foundry_images_request,
        extract_image=extract_image_payload,
    ),
    "azure_mai_images": ImageGenerationAdapter(
        name="azure_mai_images",
        build_request=_build_mai_images_request,
        extract_image=extract_image_payload,
    ),
}


def get_adapter(provider: str) -> ImageGenerationAdapter:
    """Return the adapter for ``provider`` or raise a helpful error."""
    try:
        return ADAPTERS[provider]
    except KeyError as exc:
        known = ", ".join(sorted(ADAPTERS))
        raise RuntimeError(f"Unknown image generation provider '{provider}'. Known providers: {known}.") from exc


def generate_image(
    prompt: str,
    filename_prefix: str,
    width: int = DEFAULT_WIDTH,
    height: int = DEFAULT_HEIGHT,
    output_format: str = DEFAULT_OUTPUT_FORMAT,
    model: str | None = None,
    provider: str | None = None,
    auth_mode: str | None = None,
    config: ImageGenerationConfig | None = None,
) -> Path:
    """Generate one image from ``prompt`` and save it.

    Args:
        prompt: Text prompt for the image.
        filename_prefix: Output filename without extension.
        width: Image width in pixels.
        height: Image height in pixels.
        output_format: ``png`` or ``jpeg``.
        model: Optional model override. Defaults to ``IMAGE_GENERATION_MODEL``
            or ``FLUX.2-pro``.
        provider: Optional provider adapter name. Defaults to
            ``IMAGE_GENERATION_PROVIDER`` or ``azure_flux``.
        auth_mode: Optional auth mode. Use ``api_key`` or ``azure_cli``.
        config: Optional full runtime config for tests or advanced callers.

    Returns:
        Path to the saved image.
    """
    runtime_config = config or load_config(
        model=model,
        provider=provider,
        auth_mode=auth_mode,
    )
    adapter = get_adapter(runtime_config.provider)
    request_spec = adapter.build_request(
        prompt=prompt,
        model=runtime_config.model,
        width=width,
        height=height,
        output_format=output_format,
    )
    credential_value = f"{runtime_config.header_value_prefix}{runtime_config.credential}"

    endpoint_url = build_endpoint_url(runtime_config.endpoint_url, request_spec.endpoint_path)
    response = requests.post(
        endpoint_url,
        headers={
            runtime_config.header_name: credential_value,
            "Content-Type": "application/json",
        },
        json=request_spec.body,
        timeout=runtime_config.timeout_seconds,
    )
    response.raise_for_status()

    output_path = runtime_config.output_dir / f"{filename_prefix}.{output_format}"
    payload = adapter.extract_image(response.json())
    save_image_payload(payload, output_path, runtime_config.timeout_seconds)
    return output_path
