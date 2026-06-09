FROM mcr.microsoft.com/devcontainers/python:1-3.12-bullseye

# The upstream image can contain an outdated Yarn apt source whose signing key
# breaks apt-get update before Dev Container features are installed. The Node
# feature installs the Node runtime we need, so the stale Yarn source is safe to
# remove here.
RUN rm -f /etc/apt/sources.list.d/yarn.list \
    /etc/apt/sources.list.d/yarn.sources \
    /usr/share/keyrings/yarn.gpg
