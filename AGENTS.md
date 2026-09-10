# Project runtime

- Run dependency installs, Nuxt commands, builds, lint, and tests inside the Docker Compose `dashboard` service (`gmt-calculator`), with working directory `/var/www`.
- Use `docker compose exec -T dashboard <command>` or `docker exec --workdir /var/www gmt-calculator <command>`.
- Do not run Node or package-manager commands for this project on the macOS host. The repository is bind-mounted into a Linux ARM64 container, including `node_modules`, `.nuxt`, and `.output`; host commands can replace Linux dependencies or generated files with incompatible macOS versions.
- Use the container's Yarn 1 and preserve `yarn.lock`. Use `yarn install --frozen-lockfile` for dependency installation.
- Preserve `.env`. Discover the published app port with `docker compose port dashboard 3000`; do not assume the host port is 3000.
- The container runs the dev server as its main process, so `docker compose up -d` starts it and `docker compose logs -f dashboard` reads it. Do not launch a second `yarn dev` alongside it.
- The container runs Node 24, the same major the Vercel project's Node.js Version setting builds with. Keep the two in step when either moves; there is no `engines` field overriding the platform.
- A production build may run while the dev server is up. Both default to the `.nuxt` build directory, so give the build its own; `nuxt.config.ts` reads `NUXT_BUILD_DIR` for that:
  `docker compose exec -T -e NUXT_BUILD_DIR=.cache/nuxt-build -e NITRO_PRESET=vercel dashboard yarn build`
