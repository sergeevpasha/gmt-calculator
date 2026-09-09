# Nuxt 3 Minimal Starter

Look at the [Nuxt 3 documentation](https://nuxt.com/docs/getting-started/introduction) to learn more.

## Setup

Make sure to install the dependencies:

```bash
# npm
npm install

# pnpm
pnpm install

# yarn
yarn install

# bun
bun install
```

## Development Server

Start the development server on `http://localhost:3000`:

```bash
# npm
npm run dev

# pnpm
pnpm run dev

# yarn
yarn dev

# bun
bun run dev
```

## Production

Build the application for production:

```bash
# npm
npm run build

# pnpm
pnpm run build

# yarn
yarn build

# bun
bun run build
```

Locally preview production build:

```bash
# npm
npm run preview

# pnpm
pnpm run preview

# yarn
yarn preview

# bun
bun run preview
```

Check out the [deployment documentation](https://nuxt.com/docs/getting-started/deployment) for more information.

## Data sources

Miner prices, energy efficiency upgrade prices, the daily pool payout per TH, the electricity rate and the service fee come from GoMining's public API (the same unauthenticated endpoints app.gomining.com uses):

- `POST https://api.gomining.com/api/nft-income-aggregation/get-last` — daily payout per TH, fees and the BTC rate used for the payout
- `GET https://api.gomining.com/api/nft-collection/find-all-generative` — miner presets with prices
- `POST https://api.gomining.com/api/nft/get-upgrade-rate` — energy efficiency upgrade prices per W/TH step

The browser cannot call that API directly (no CORS headers), so the page requests `/api/market`, a Nitro route in `server/api/market.get.ts` that proxies, normalizes and caches the data for 10 minutes. When GoMining is unreachable the route serves `data/gomining-snapshot.json`; refresh that snapshot inside the container with `yarn update-snapshot`. The Bitcoin price comes from CoinGecko, with GoMining's payout rate as the fallback.

Run the calculation tests with `yarn test`.
