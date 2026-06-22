# Use Node.js 22 LTS (matches your current version)
FROM node:22-bookworm

# Install additional OS packages if needed
RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
    && apt-get -y install --no-install-recommends \
    # Add any additional OS packages here
    curl \
    wget \
    ca-certificates \
    && apt-get clean -y \
    && rm -rf /var/lib/apt/lists/*

# Update npm to latest version
RUN npm install -g npm@latest

# Install global npm packages that might be useful
RUN npm install -g \
    @11ty/eleventy \
    npm-check-updates \
    http-server

# Set the working directory
WORKDIR /workspace

# Expose the Eleventy dev server port
EXPOSE 8080

# Default command (can be overridden)
CMD ["bash"]
