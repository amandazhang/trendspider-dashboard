create extension if not exists pgcrypto;

create table if not exists public.trendspider_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  alert_name text not null,
  event text not null default 'alert_triggered',
  direction text not null default 'neutral' check (direction in ('bullish', 'bearish', 'neutral')),
  price numeric,
  timeframe text,
  note text,
  status text not null default 'triggered',
  triggered_at timestamptz not null default now(),
  received_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb
);

create index if not exists trendspider_signals_triggered_at_idx
  on public.trendspider_signals (triggered_at desc);

alter table public.trendspider_signals enable row level security;

revoke all on public.trendspider_signals from anon;

-- Expose only display-safe columns. raw_payload remains private and may contain
-- provider metadata that should never be returned to an anonymous browser.
create or replace view public.trendspider_signal_feed as
select id, symbol, alert_name, event, direction, price, timeframe, note, status, triggered_at
from public.trendspider_signals;

grant select on public.trendspider_signal_feed to anon;

-- Only the Edge Function service role can access the table directly.
