# TrendSpider Signals setup

The TrendSpider panel is informational only. Incoming signals are displayed in a separate section and do not alter the market-quality score or submit orders.

## 1. Create the Supabase data layer

1. Create a Supabase project.
2. Open the SQL editor and run `supabase/migrations/20260923000000_trendspider_signals.sql`.
3. Deploy `supabase/functions/trendspider-webhook` as an Edge Function with JWT verification disabled. TrendSpider cannot provide a Supabase JWT; the function authenticates requests using the private payload secret instead.
4. Create a long random secret and set it as the Edge Function secret `TRENDSPIDER_WEBHOOK_SECRET`.

Never expose the service-role key or webhook secret in the browser build. Supabase automatically supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to the deployed Edge Function.

## 2. Connect the dashboard

Copy `client/.env.example` to `client/.env.local` and set:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

For GitHub Pages, add those two values under **Settings → Secrets and variables → Actions → Variables**. The included workflow passes them to the static build. These values are intended to be public. Anonymous users can read only the safe feed view; they cannot read raw payloads or insert rows.

## 3. Configure TrendSpider

Use the deployed function URL:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/trendspider-webhook
```

Add this JSON as the alert note/body, replacing the secret and the fields TrendSpider cannot infer for that alert:

```json
{
  "secret": "YOUR_LONG_RANDOM_SECRET",
  "source": "trendspider",
  "alert": "%alert_name%",
  "symbol": "%alert_symbol%",
  "event": "%price_action_event%",
  "price": "%last_price%",
  "direction": "bullish",
  "timeframe": "daily",
  "status": "triggered",
  "note": "Daily breakout confirmation",
  "chart_url": "https://OPTIONAL-PUBLIC-CHART-IMAGE-URL",
  "source_url": "https://OPTIONAL-SOURCE-PAGE-URL"
}
```

`chart_url` and `source_url` are optional and must use HTTPS. Standard
TrendSpider alert webhooks do not automatically include a chart screenshot;
omit these fields unless you have a public chart/share URL to send.

For a Strategy Bot, use its supported variables instead:

```json
{
  "secret": "YOUR_LONG_RANDOM_SECRET",
  "source": "trendspider",
  "alert": "%bot_name%",
  "symbol": "%bot_symbol%",
  "event": "strategy_bot",
  "price": "%last_price%",
  "direction": "%bot_status%",
  "timeframe": "%bot_timeframe%",
  "status": "%bot_status%"
}
```

## 4. Test before relying on it

Send a test POST, confirm a row appears in `trendspider_signals`, then verify the dashboard displays it within ten seconds. The receiver removes the secret before storing the raw payload. Rotate the secret immediately if it is ever shared or committed.

The public-read policy is appropriate only when signal history is safe to display publicly. For a private dashboard, replace it with authenticated reads before deployment.
