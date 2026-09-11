FROM mcr.microsoft.com/devcontainers/python:1-3.12-bullseye

ARG OPENCODE_VERSION=1.18.23

# The upstream image can contain an outdated Yarn apt source whose signing key
# breaks apt-get update before Dev Container features are installed. The Node
# feature installs the Node runtime we need, so the stale Yarn source is safe to
# remove here.
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    /etc/apt/sources.list.d/yarn.sources \
    /usr/share/keyrings/yarn.gpg

RUN curl -fsSL https://opencode.ai/install \
    | bash -s -- --version "${OPENCODE_VERSION}" --no-modify-path \
    && install -m 0755 /root/.opencode/bin/opencode /usr/local/bin/opencode \
    && opencode --version
