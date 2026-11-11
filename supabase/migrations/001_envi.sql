-- Lanuk Envi tables in project lanuk-x (Supabase account 2).
-- Prefixed envi_ so they never collide with the Lanuk.X website tables.
-- RLS is on with no policies, and anon/authenticated have no grants:
-- only the Envi server, holding the service_role key, can read or write.

create table if not exists public.envi_conversations (
  id          uuid primary key default gen_random_uuid(),
  title       text not null default 'New conversation',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.envi_messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.envi_conversations(id) on delete cascade,
  role             text not null check (role in ('user', 'assistant')),
  content          text not null,
  provider         text check (provider in ('claude', 'codex', 'local', 'snapshot')),
  model            text,
  ms               integer check (ms >= 0),
  created_at       timestamptz not null default now()
);
create index if not exists envi_messages_conv_idx on public.envi_messages (conversation_id, created_at);

create table if not exists public.envi_missions (
  id          text primary key,
  title       text not null,
  why         text not null default '',
  tag         text not null default '',
  severity    text not null default 'warn' check (severity in ('crit', 'warn', 'idle')),
  sort        integer not null default 0,
  done        boolean not null default false,
  done_at     timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.envi_costs (
  id            text primary key,
  tool          text not null,
  plan          text not null default '',
  kind          text not null default 'AI tool' check (kind in ('AI tool', 'Other tool')),
  amount        numeric(12, 2) not null check (amount >= 0),
  currency      text not null default 'INR' check (currency in ('INR', 'USD')),
  cycle         text not null default 'monthly' check (cycle in ('monthly', 'yearly')),
  paid_through  date,
  confirmed     boolean not null default false,
  updated_at    timestamptz not null default now()
);

create table if not exists public.envi_income (
  id          text primary key,
  client      text not null,
  type        text not null default '',
  amount      numeric(12, 2) check (amount >= 0),
  currency    text not null default 'INR' check (currency in ('INR', 'USD')),
  date        date,
  status      text not null default 'Expected' check (status in ('Expected', 'Received')),
  updated_at  timestamptz not null default now()
);

create table if not exists public.envi_config (
  id           text primary key default 'main' check (id = 'main'),
  usd_inr      numeric(10, 2) not null default 85,
  target_min   numeric(12, 2) not null default 100000,
  target_max   numeric(12, 2) not null default 250000,
  tool_budget  numeric(12, 2) not null default 15000,
  tax_pct      numeric(5, 2)  not null default 10,
  updated_at   timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['envi_conversations','envi_messages','envi_missions','envi_costs','envi_income','envi_config'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end $$;
