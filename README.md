# GMT Calculator

The GoMining mining calculator behind [gmt.guru](https://gmt.guru), a Nuxt 3 app deployed on Vercel.

## Running it

Everything runs in the `gmt-calculator` container: Node, Yarn, the dev server, builds and tests. Do not run Node or Yarn on the macOS host. The repository is bind-mounted into a Linux container including `node_modules`, so a host install replaces the Linux dependencies with incompatible macOS builds.

```bash
make up
```

That builds the image if needed, installs dependencies on first boot and starts the Nuxt dev server. The published port comes from `DOCKER_NODEJS_PORT` in `.env`; read it back with `docker compose port dashboard 3000`. Follow the server with `make logs`, open a shell with `make bash`, and stop everything with `make down`.

Run any other project command inside the container:

```bash
docker compose exec -T dashboard yarn lint
docker compose exec -T dashboard yarn test
docker compose exec -T dashboard yarn update-snapshot
```

A production build can run while the dev server is up. Both default to the `.nuxt` build directory and would overwrite each other, so give the build its own with `NUXT_BUILD_DIR`:

```bash
docker compose exec -T -e NUXT_BUILD_DIR=.cache/nuxt-build -e NITRO_PRESET=vercel dashboard yarn build
```

That runs the same Vercel preset the deploy uses, so it catches build failures before pushing.

The container runs Node 24, the same major the Vercel project is set to build with. Use `yarn install --frozen-lockfile` and keep `yarn.lock`.

## Branding

`public/logo.svg` is the master logomark (the `₿=` mark). The favicons, touch icons and Windows tiles in `public/` are rendered from it, and `components/svg/AppLogo.vue` inlines the same paths for the header.

## Data sources

Miner prices, energy efficiency upgrade prices, the daily pool payout per TH, the electricity rate and the service fee come from GoMining's public API (the same unauthenticated endpoints app.gomining.com uses):

- `POST https://api.gomining.com/api/nft-income-aggregation/get-last` — daily payout per TH, fees and the BTC rate used for the payout
- `GET https://api.gomining.com/api/nft-collection/find-all-generative` — the miners GoMining sells in the app, with prices
- `POST https://api.gomining.com/api/nft/get-upgrade-rate` — energy efficiency upgrade prices per W/TH step

The calculators accept any whole-number efficiency from 12 to 20 W/TH, priced from primary-market data only. GoMining publishes a full price ladder for some efficiencies (12 and 15 W/TH today); every size it lists on those ladders costs exactly what GoMining charges. A level between two published ladders is interpolated between their real prices at the same power, and a level worse than every published ladder steps down from the least efficient one using the per-W/TH valuation rates from `get-upgrade-rate`. Secondary-market listings are never used.

Those two rate tables are easy to confuse. `powerUpgradePriceConfig` sets what a TH is worth at each efficiency and drives pricing; `energyEfficiencyUpgradePriceConfig` is what an owner pays to improve a miner, and drives the "Worth upgrading?" table. Both are shown in the "Where these numbers come from" panel on the page.

The browser cannot call that API directly (no CORS headers), so the page requests `/api/market`, a Nitro route in `server/api/market.get.ts` that proxies, normalizes and caches the data for 10 minutes. When GoMining is unreachable the route serves `data/gomining-snapshot.json`; refresh that snapshot inside the container with `yarn update-snapshot`. The Bitcoin price comes from CoinGecko, with GoMining's payout rate as the fallback.

Run the calculation tests with `yarn test`.
