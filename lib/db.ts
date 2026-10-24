import "server-only";
import { neon } from "@neondatabase/serverless";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
type Runner = (text: string, params: unknown[]) => Promise<Row[]>;

const SCHEMA = [
  `create table if not exists rolls (
    id text primary key,
    slug text unique not null,
    mode text not null,
    package text not null,
    exposures integer not null,
    price integer not null,
    name text not null,
    owner_name text,
    owner_hash text not null,
    look text not null default 'film35',
    guest_looks boolean not null default true,
    date_stamp boolean not null default true,
    develop_mode text not null default 'hour',
    ends_at timestamptz,
    finished_at timestamptz,
    paid boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create table if not exists members (
    id text primary key,
    roll_id text not null references rolls(id) on delete cascade,
    name text not null,
    token_hash text,
    is_owner boolean not null default false,
    created_at timestamptz not null default now()
  )`,
  `create index if not exists members_roll_idx on members(roll_id)`,
  `create table if not exists photos (
    id text primary key,
    roll_id text not null references rolls(id) on delete cascade,
    member_id text references members(id) on delete set null,
    member_name text,
    url text not null,
    thumb_url text not null,
    width integer,
    height integer,
    source text not null default 'camera',
    created_at timestamptz not null default now()
  )`,
  `create index if not exists photos_roll_idx on photos(roll_id, created_at)`,
  `create table if not exists payments (
    order_id text primary key,
    roll_id text not null references rolls(id) on delete cascade,
    amount integer not null,
    status text not null default 'pending',
    payment_type text,
    snap_token text,
    created_at timestamptz not null default now(),
    paid_at timestamptz
  )`,
  `create index if not exists payments_roll_idx on payments(roll_id, status)`,
  `create table if not exists rate_limits (
    k text not null,
    bucket bigint not null,
    n integer not null default 1,
    expires_at timestamptz not null,
    primary key (k, bucket)
  )`,
  `create table if not exists metrics (
    id bigserial primary key,
    name text not null,
    ref text,
    amount integer not null default 0,
    bytes bigint not null default 0,
    at timestamptz not null default now()
  )`,
  `create index if not exists metrics_name_at_idx on metrics(name, at)`,
  // reserved exposures per roll: an atomic counter keeps parallel uploads within the roll
  `alter table rolls add column if not exists shots_used integer`,
  `update rolls r set shots_used = (select count(*) from photos p where p.roll_id = r.id) where shots_used is null`,
  `alter table rolls alter column shots_used set default 0`,
  `create index if not exists rolls_created_idx on rolls(created_at)`,
];

let runnerPromise: Promise<Runner> | null = null;

export function isLocalDev() {
  return process.env.LOCAL_DEV === "1";
}

function databaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL ||
    ""
  );
}

async function createRunner(): Promise<Runner> {
  let run: Runner;
  if (isLocalDev()) {
    const { PGlite } = await import("@electric-sql/pglite");
    const fs = await import("node:fs");
    fs.mkdirSync(".local-data", { recursive: true });
    const db = new PGlite(".local-data/db");
    run = async (text, params) => (await db.query(text, params as any[])).rows as Row[];
  } else {
    const url = databaseUrl();
    if (!url) {
      throw new Error(
        "DATABASE_URL belum diatur. Hubungkan Neon ke project Vercel (Storage → Neon) lalu redeploy."
      );
    }
    const sql = neon(url);
    run = async (text, params) => (await sql.query(text, params)) as Row[];
  }
  for (const stmt of SCHEMA) await run(stmt, []);
  return run;
}

// Pages and route handlers are bundled separately; share one runner per process
// (important for the local pglite database, harmless for Neon).
const g = globalThis as unknown as { __jepretRunner?: Promise<Runner> | null };

function runner() {
  if (g.__jepretRunner) return g.__jepretRunner;
  if (!runnerPromise) {
    runnerPromise = createRunner().catch((err) => {
      runnerPromise = null;
      g.__jepretRunner = null;
      throw err;
    });
    g.__jepretRunner = runnerPromise;
  }
  return runnerPromise;
}

export async function query<T = Row>(text: string, params: unknown[] = []): Promise<T[]> {
  const run = await runner();
  return (await run(text, params)) as T[];
}

export async function one<T = Row>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
