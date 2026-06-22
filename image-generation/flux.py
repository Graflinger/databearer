"""Backward-compatible FLUX import shim.

New code should import from ``image_generator``. This module stays in place so
existing notebooks or ad-hoc scripts using ``from flux import generate_image``
continue to work.
"""

from image_generator import (  # noqa: F401
    DEFAULT_HEIGHT,
    DEFAULT_AUTH_MODE,
    DEFAULT_MODEL,
    DEFAULT_OUTPUT_FORMAT,
    DEFAULT_PROVIDER,
    DEFAULT_WIDTH,
    ADAPTERS,
    ImageGenerationConfig,
    ImageGenerationAdapter,
    ImagePayload,
    RequestSpec,
    build_endpoint_url,
    build_foundry_images_body,
    build_mai_images_body,
    build_openai_images_body,
    build_request_body,
    decode_and_save_image,
    extract_b64_image,
    extract_image_payload,
    generate_image,
    get_azure_cli_token,
    get_adapter,
    load_config,
    resolve_output_dir,
)
