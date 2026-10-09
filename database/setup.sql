-- Supabase SQL Editor에서 한 번 실행. 기존 프로젝트의 다른 테이블은 건드리지 않습니다.
create table if not exists public.class_board_rooms (
  code text primary key check (code ~ '^[A-Z0-9]{6}$'),
  state jsonb not null,
  revision integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.class_board_rooms enable row level security;
revoke all on public.class_board_rooms from anon, authenticated;
grant select, insert, update on public.class_board_rooms to service_role;
-- 브라우저는 이 테이블에 직접 접근하지 않음. Vercel 서버가 비밀 키로 접근합니다.
-- revision 조건부 UPDATE로 여러 수강생의 동시 응답이 덮어써지지 않게 합니다.
