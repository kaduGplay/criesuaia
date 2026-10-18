-- Funnel analytics for Crie sua IA. Only service_role (the /api/track function) may access it.
create table public.criesuaia_funnel_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  sid text not null,
  vid text,
  event text not null,
  qp smallint,
  question text,
  answer text,
  meta jsonb,
  utm jsonb,
  device text,
  country text,
  page text
);
create index criesuaia_funnel_created on public.criesuaia_funnel_events(created_at);
create index criesuaia_funnel_sid on public.criesuaia_funnel_events(sid);
alter table public.criesuaia_funnel_events enable row level security;
revoke all on public.criesuaia_funnel_events from public, anon, authenticated;
grant select, insert, delete on public.criesuaia_funnel_events to service_role;

-- Sessions that reached each step, in funnel order, for the last p_days days (São Paulo time).
create or replace function public.criesuaia_funnel_report(p_days integer default 1)
returns table(rank integer, step text, sessions bigint)
language sql security invoker set search_path='' as $$
  with cohort as (
    select * from public.criesuaia_funnel_events
    where created_at >= (date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo')
                        - (greatest(1, least(p_days, 90)) - 1) * interval '1 day'
  ), steps as (
    select case event
      when 'quiz_start' then 0 when 'quiz_begin' then 1 when 'question_answered' then 10 + coalesce(qp, 0)
      when 'quiz_completed' then 40 when 'email_submitted' then 41 when 'preview_viewed' then 42
      when 'name_submitted' then 43 when 'user_name_submitted' then 44 when 'teaser_viewed' then 45
      when 'teaser_unlock_click' then 46 when 'offer_viewed' then 47
      when 'checkout_viewed' then 48 when 'checkout_form_started' then 49 when 'pix_generated' then 50
      when 'checkout_error' then 51 when 'pix_paid' then 52 when 'upsell_pix_generated' then 53 when 'upsell_paid' then 54
    end as rank,
    case event
      when 'quiz_start' then 'Abriu o site' when 'quiz_begin' then 'Começou o quiz'
      when 'question_answered' then 'Pergunta ' || qp || ': ' || coalesce(question, '')
      when 'quiz_completed' then 'Terminou o quiz' when 'email_submitted' then 'Deixou o e-mail'
      when 'preview_viewed' then 'Viu a revelação' when 'name_submitted' then 'Deu nome a ela'
      when 'user_name_submitted' then 'Disse o próprio nome' when 'teaser_viewed' then 'Viu a conversa de amostra'
      when 'teaser_unlock_click' then 'Tocou em desbloquear' when 'offer_viewed' then 'Viu a oferta'
      when 'checkout_viewed' then 'Abriu o checkout' when 'checkout_form_started' then 'Mexeu no formulário'
      when 'pix_generated' then 'Gerou o PIX' when 'checkout_error' then 'Teve erro no checkout'
      when 'pix_paid' then 'Pagou' when 'upsell_pix_generated' then 'Gerou PIX de upsell' when 'upsell_paid' then 'Pagou upsell'
    end as step,
    sid
    from cohort
  )
  select rank, max(step), count(distinct sid) from steps where rank is not null group by rank order by rank;
$$;
revoke all on function public.criesuaia_funnel_report(integer) from public, anon, authenticated;
grant execute on function public.criesuaia_funnel_report(integer) to service_role;
