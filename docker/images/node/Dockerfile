FROM node:24.20-bookworm-slim

ARG UID=1000
ARG GID=1000

USER root
RUN groupmod -o -g "${GID}" node && usermod -o -u "${UID}" -g "${GID}" node
RUN apt-get update && apt-get install -y --no-install-recommends procps ripgrep && rm -rf /var/lib/apt/lists/*

USER node

WORKDIR /var/www

# Dependencies are only ever installed from inside the container, so the Node
# that builds them is the Node that runs them. Installing on first boot means a
# fresh clone comes up with one `docker compose up`, and the UID remap above
# keeps everything written into the bind mount owned by the host user.
CMD ["sh", "-c", "[ -d node_modules ] || yarn install --frozen-lockfile; exec yarn dev"]
