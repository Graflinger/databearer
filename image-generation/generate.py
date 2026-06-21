"""Thin CLI wrapper around :func:`image_generator.generate_image`.

Examples:
    python generate.py --prompt "calm anime-style wind turbines" --out windenergie4
    python generate.py -p "rooftop solar at dawn" -o solar1 --width 1024 --height 1024
    python generate.py -p "factory skyline" -o industry --model FLUX.2-pro --provider azure_flux
"""

from __future__ import annotations

import argparse
import sys

import requests

from image_generator import (
    ADAPTERS,
    DEFAULT_AUTH_MODE,
    DEFAULT_HEIGHT,
    DEFAULT_MODEL,
    DEFAULT_OUTPUT_FORMAT,
    DEFAULT_PROVIDER,
    DEFAULT_WIDTH,
    generate_image,
)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate an image via a configured image model.")
    parser.add_argument("--prompt", "-p", required=True, help="Text prompt for the image.")
    parser.add_argument(
        "--out",
        "-o",
        required=True,
        help="Output filename prefix (without extension).",
    )
    parser.add_argument("--width", type=int, default=DEFAULT_WIDTH, help="Image width in px.")
    parser.add_argument("--height", type=int, default=DEFAULT_HEIGHT, help="Image height in px.")
    parser.add_argument(
        "--model",
        default=None,
        help=(
            "Model name to send in the request body. "
            f"Defaults to IMAGE_GENERATION_MODEL or {DEFAULT_MODEL}."
        ),
    )
    parser.add_argument(
        "--provider",
        default=None,
        choices=sorted(ADAPTERS),
        help=(
            "Provider adapter to use. "
            f"Defaults to IMAGE_GENERATION_PROVIDER or {DEFAULT_PROVIDER}."
        ),
    )
    parser.add_argument(
        "--auth-mode",
        choices=["api_key", "azure_cli"],
        default=None,
        help=(
            "Authentication mode. "
            f"Defaults to IMAGE_GENERATION_AUTH_MODE or {DEFAULT_AUTH_MODE}."
        ),
    )
    parser.add_argument(
        "--output-format",
        default=DEFAULT_OUTPUT_FORMAT,
        choices=["png", "jpeg"],
        help="Output image format.",
    )
    args = parser.parse_args(argv)

    try:
        output_path = generate_image(
            prompt=args.prompt,
            filename_prefix=args.out,
            width=args.width,
            height=args.height,
            output_format=args.output_format,
            model=args.model,
            provider=args.provider,
            auth_mode=args.auth_mode,
        )
    except requests.exceptions.RequestException as exc:
        print(f"Image generation request failed: {exc}", file=sys.stderr)
        return 1
    except RuntimeError as exc:
        print(f"Image generation failed: {exc}", file=sys.stderr)
        return 1

    print(f"Image saved to: {output_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
