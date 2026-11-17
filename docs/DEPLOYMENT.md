# Deploying the dashboard to Vercel

The dashboard is a static Vite build in `dashboard/`. It reads only the derived JSON in
`dashboard/public/data/` (about 2 MB); the raw Data Pack is never deployed.
`dashboard/vercel.json` sets the build, the single-page-app rewrite and cache headers.

## Option A: import the GitHub repository (recommended)

1. Go to <https://vercel.com/new> and import `ArnavLabh/SupeRR-Selector-Hackathon-Season-2`.
2. Set **Root Directory** to `dashboard`. Vercel detects Vite; leave the defaults
   (build `npm run build`, output `dist`).
3. Deploy. Every push to `main` redeploys.

## Option B: Vercel CLI

```bash
vercel login
```

```bash
cd dashboard
vercel --prod
```

The first run asks you to link a project: accept the defaults and confirm `./` as the directory.

## After deploying

Save the production URL into `reports/dashboard_url.txt`, then regenerate the files that print it:

```bash
python reports/build_report.py
```

Check these pages load on the live URL: `/`, `/pressure`, `/rankings?d=bowl`,
`/player/bowl/781`, `/method`, `/auction`. A direct load of a deep link should not return 404;
the rewrite in `vercel.json` handles that.
