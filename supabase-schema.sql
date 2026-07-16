-- ============================================================
-- 学園セトリ予想ビンゴ: Supabase スキーマ (複数大会対応版)
-- Supabaseダッシュボード > SQL Editor に貼り付けて実行してください。
-- 既存の game_saves テーブルがある場合は作り直しになるため、
-- 過去データが不要であれば先に drop table if exists で消してから実行してください。
--   drop table if exists public.game_saves;
-- ============================================================

-- ---------------- 大会(イベント) ----------------
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,                -- 例: 「福井公演 Day1」
  event_date date,                   -- 開催日
  deadline timestamptz not null,     -- 予想締切
  created_by uuid references auth.users(id) not null,
  setlist_front_count integer,       -- (非推奨・未使用) 前半/後半を分けていた頃の名残。今は判定に使っていない
  created_at timestamptz not null default now()
);

-- 既存のテーブルに対しては以下を個別に実行してください(既にある場合はエラーにならずスキップされる)
alter table public.events add column if not exists setlist_front_count integer;

alter table public.events enable row level security;

drop policy if exists "events select all" on public.events;
drop policy if exists "events insert own" on public.events;
drop policy if exists "events update own" on public.events;
drop policy if exists "events delete own" on public.events;

-- 大会一覧はログインしていれば誰でも見れる(プルダウン用)
create policy "events select all"
  on public.events for select
  using (auth.role() = 'authenticated');

-- 作成は自分がcreated_byになる形でのみ許可
-- (将来「誰でも大会を作れる」に開放する場合もこのポリシーのままでOK。
--  現状はアプリ側のUIで作成ボタンの表示を制限している)
create policy "events insert own"
  on public.events for insert
  with check (auth.uid() = created_by);

-- 更新・削除はその大会の作成者(管理者)のみ
create policy "events update own"
  on public.events for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "events delete own"
  on public.events for delete
  using (auth.uid() = created_by);


-- ---------------- (非推奨・未使用) 大会ごとの候補曲リスト ----------------
-- 現在は songs.json (静的ファイル、全大会共通) を使うため、このテーブルはアプリから参照していません。
-- 削除しても動作に影響ありませんが、安全のため残してあります。
create table if not exists public.event_songs (
  event_id uuid references public.events(id) on delete cascade,
  song text not null,
  primary key (event_id, song)
);

alter table public.event_songs enable row level security;

drop policy if exists "event_songs select all" on public.event_songs;
drop policy if exists "event_songs write admin" on public.event_songs;

create policy "event_songs select all"
  on public.event_songs for select
  using (auth.role() = 'authenticated');

create policy "event_songs write admin"
  on public.event_songs for all
  using (
    exists (select 1 from public.events e where e.id = event_songs.event_id and e.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = event_songs.event_id and e.created_by = auth.uid())
  );


-- ---------------- (非推奨・未使用) 大会ごとの担当アイドル候補一覧 ----------------
-- 現在は casts.json (静的ファイル、全大会共通) を使うため、このテーブルはアプリから参照していません。
create table if not exists public.event_idols (
  event_id uuid references public.events(id) on delete cascade,
  idol text not null,
  cv text,                            -- 声優(CV)名。正解セトリの歌唱者名はCV表記のため、的中判定はこちらを使う
  primary key (event_id, idol)
);

-- 既存のテーブルに対しては以下を個別に実行してください(既にある場合はエラーにならずスキップされる)
alter table public.event_idols add column if not exists cv text;

alter table public.event_idols enable row level security;

drop policy if exists "event_idols select all" on public.event_idols;
drop policy if exists "event_idols write admin" on public.event_idols;

create policy "event_idols select all"
  on public.event_idols for select
  using (auth.role() = 'authenticated');

create policy "event_idols write admin"
  on public.event_idols for all
  using (
    exists (select 1 from public.events e where e.id = event_idols.event_id and e.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = event_idols.event_id and e.created_by = auth.uid())
  );


-- ---------------- 大会ごとの正解セトリ(管理者がライブ後にCSVで登録) ----------------
create table if not exists public.event_setlists (
  event_id uuid references public.events(id) on delete cascade,
  position integer not null,          -- 1〜24 (1=1曲目/OPENING, 24=ラスト曲/ENCORE)
  song text not null,
  members text[] not null default '{}',
  primary key (event_id, position)
);

alter table public.event_setlists enable row level security;

drop policy if exists "setlists select all" on public.event_setlists;
drop policy if exists "setlists write admin" on public.event_setlists;

-- 正解セトリは判定計算のため全員が読める(ログインユーザーのみ)
create policy "setlists select all"
  on public.event_setlists for select
  using (auth.role() = 'authenticated');

-- 登録・更新・削除はその大会の管理者(events.created_by)のみ
create policy "setlists write admin"
  on public.event_setlists for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_setlists.event_id
        and e.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.events e
      where e.id = event_setlists.event_id
        and e.created_by = auth.uid()
    )
  );


-- ---------------- ユーザーごとの予想データ(大会×ユーザー単位、非公開) ----------------
create table if not exists public.game_saves (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references auth.users(id),
  username text,
  board jsonb not null default '[]'::jsonb,
  bets jsonb not null default '{}'::jsonb,
  points integer not null default 10000,
  selected_idol text,
  selected_idol_cv text,               -- 担当アイドルの声優(CV)名。的中判定はこちらで行う
  comment text,
  confirmed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- 既存のテーブルに対しては以下を個別に実行してください(既にある場合はエラーにならずスキップされる)
alter table public.game_saves add column if not exists username text;
alter table public.game_saves add column if not exists selected_idol_cv text;

alter table public.game_saves enable row level security;

drop policy if exists "saves select own" on public.game_saves;
drop policy if exists "saves insert own" on public.game_saves;
drop policy if exists "saves update own" on public.game_saves;
drop policy if exists "saves select admin" on public.game_saves;
drop policy if exists "saves update admin" on public.game_saves;

create policy "saves select own"
  on public.game_saves for select
  using (auth.uid() = user_id);

create policy "saves insert own"
  on public.game_saves for insert
  with check (auth.uid() = user_id);

create policy "saves update own"
  on public.game_saves for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 大会の管理者は、一括採点のために確定済みの予想データを読み取れる
create policy "saves select admin"
  on public.game_saves for select
  using (
    exists (select 1 from public.events e where e.id = game_saves.event_id and e.created_by = auth.uid())
  );

-- 大会の管理者は、一括採点結果を各ユーザーの持ち点に反映できる
create policy "saves update admin"
  on public.game_saves for update
  using (
    exists (select 1 from public.events e where e.id = game_saves.event_id and e.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = game_saves.event_id and e.created_by = auth.uid())
  );


-- ---------------- ランキング公開データ(「確定」を押すと書き込まれる) ----------------
create table if not exists public.results (
  event_id uuid references public.events(id) on delete cascade,
  user_id uuid references auth.users(id),
  username text not null,
  selected_idol text,
  comment text,
  total_points integer,               -- 結果発表(正解セトリ登録)前はnull
  bingo_count integer,                -- 結果発表(正解セトリ登録)前はnull
  confirmed_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- 既存のテーブルに対しては以下を実行してNOT NULL制約を外してください
alter table public.results alter column total_points drop not null;
alter table public.results alter column bingo_count drop not null;

alter table public.results enable row level security;

drop policy if exists "results select all" on public.results;
drop policy if exists "results insert own" on public.results;
drop policy if exists "results update own" on public.results;
drop policy if exists "results write admin" on public.results;

-- ランキングは大会参加者全員が読める
create policy "results select all"
  on public.results for select
  using (auth.role() = 'authenticated');

-- 書き込みは本人の分だけ
create policy "results insert own"
  on public.results for insert
  with check (auth.uid() = user_id);

create policy "results update own"
  on public.results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 大会の管理者は、一括採点のため参加者全員分のresultsを書き込める
create policy "results write admin"
  on public.results for all
  using (
    exists (select 1 from public.events e where e.id = results.event_id and e.created_by = auth.uid())
  )
  with check (
    exists (select 1 from public.events e where e.id = results.event_id and e.created_by = auth.uid())
  );


-- ============================================================
-- トレンド(みんなの予想傾向)機能
-- ============================================================

-- 集計済みトレンドデータ(1大会1行、集計関数がここに書き込む)
create table if not exists public.event_trends (
  event_id uuid references public.events(id) on delete cascade primary key,
  trends_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.event_trends enable row level security;

drop policy if exists "event_trends select all" on public.event_trends;
create policy "event_trends select all"
  on public.event_trends for select
  using (auth.role() = 'authenticated');

-- トレンド集計関数
-- security definer にすることで、呼び出したユーザーの権限に関係なく
-- 全大会の確定済み予想(game_saves)を横断集計できるようにしている。
-- 書き込み先はevent_trends(集計値のみ)で、個人の予想内容自体は外に出ない。
create or replace function public.aggregate_event_trends()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  evt_id uuid;
begin
  for evt_id in select id from public.events loop
    insert into public.event_trends (event_id, trends_json, updated_at)
    values (
      evt_id,
      jsonb_build_object(
        -- 前半後半問わず、ビンゴシート全体で最も選ばれている曲(上位10曲)
        'popular_songs', (
          select coalesce(jsonb_agg(t), '[]'::jsonb) from (
            select song_name, count(*) as votes
            from (
              select jsonb_array_elements_text(board) as song_name
              from public.game_saves
              where event_id = evt_id and confirmed = true
            ) sub
            where song_name is not null and song_name <> ''
            group by song_name
            order by votes desc
            limit 10
          ) t
        ),
        -- 1曲目(OPENING、左上マス=board[0])予想の人気上位5曲
        'first_songs', (
          select coalesce(jsonb_agg(t), '[]'::jsonb) from (
            select board->>0 as song_name, count(*) as votes
            from public.game_saves
            where event_id = evt_id and confirmed = true
              and jsonb_array_length(board) > 0
              and board->>0 is not null
            group by song_name
            order by votes desc
            limit 5
          ) t
        ),
        -- ラスト曲(ENCORE、右下マス=board[24])予想の人気上位5曲
        'last_songs', (
          select coalesce(jsonb_agg(t), '[]'::jsonb) from (
            select board->>24 as song_name, count(*) as votes
            from public.game_saves
            where event_id = evt_id and confirmed = true
              and jsonb_array_length(board) >= 25
              and board->>24 is not null
            group by song_name
            order by votes desc
            limit 5
          ) t
        )
      ),
      now()
    )
    on conflict (event_id) do update
    set trends_json = excluded.trends_json, updated_at = excluded.updated_at;
  end loop;
end;
$$;

grant execute on function public.aggregate_event_trends() to authenticated;

-- ------------------------------------------------------------------
-- pg_cronの有効化(3時間おきの自動集計)
-- 注意: pg_cronがプランで使えない場合、この create extension でエラーになります。
-- その場合はこの3行(create extension 〜 select cron.schedule)だけ実行せずに
-- スキップしてください。アプリ側の「今すぐ集計する」ボタンで手動運用できます。
-- ------------------------------------------------------------------
create extension if not exists pg_cron;

select cron.schedule(
  'aggregate-trends-every-3-hours',
  '0 */3 * * *',
  'select public.aggregate_event_trends()'
);


-- ============================================================
-- Authenticationの設定(SQLではなくダッシュボードから行う項目)
-- ============================================================
-- Authentication > Providers > Email で以下を確認/変更してください。
-- 1. "Confirm email" を OFF にする
-- 2. Site URL / Redirect URLs に、GitHub PagesのURLを追加
