alter table public.trendspider_signals
  add column if not exists chart_url text,
  add column if not exists source_url text;

create or replace view public.trendspider_signal_feed as
select
  id,
  symbol,
  alert_name,
  event,
  direction,
  price,
  timeframe,
  note,
  status,
  triggered_at,
  chart_url,
  source_url
from public.trendspider_signals;

grant select on public.trendspider_signal_feed to anon;
