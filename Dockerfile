FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends curl ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

COPY --chmod=755 entrypoint.sh /usr/local/bin/entrypoint.sh

# Install Claude Code via the official install script as the non-root user
USER node
WORKDIR /home/node
RUN curl -fsSL https://claude.ai/install.sh | bash

WORKDIR /home/node/workspace
ENTRYPOINT ["entrypoint.sh"]
CMD []
