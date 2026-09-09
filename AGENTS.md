# Project runtime

- Run dependency installs, Nuxt commands, builds, lint, and tests inside the Docker Compose `dashboard` service (`gmt-calculator`), with working directory `/var/www`.
- Use `docker compose exec -T dashboard <command>` or `docker exec --workdir /var/www gmt-calculator <command>`.
- Do not run Node or package-manager commands for this project on the macOS host. The repository is bind-mounted into a Linux ARM64 container, including `node_modules`, `.nuxt`, and `.output`; host commands can replace Linux dependencies or generated files with incompatible macOS versions.
- Use the container's Yarn 1 and preserve `yarn.lock`. Use `yarn install --frozen-lockfile` for dependency installation.
- Preserve `.env`. Discover the published app port with `docker compose port dashboard 3000`; do not assume the host port is 3000.
- Stop an active Nuxt dev process before a production build: they share `.nuxt`, and concurrent writes can corrupt generated manifests.
