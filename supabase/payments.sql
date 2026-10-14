-- Dedicated payment storage. Only service_role may access it.
create table public.criesuaia_payment_store (
  key text primary key check (key like 'pix:%'),
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.criesuaia_payment_store enable row level security;
revoke all on public.criesuaia_payment_store from public, anon, authenticated;
grant select, insert, update, delete on public.criesuaia_payment_store to service_role;

create function public.criesuaia_payment_command(p_operation text, p_keys text[], p_values text[] default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v text; j jsonb; inserted int;
begin
  if coalesce(array_length(p_keys,1),0)<1 or exists(select 1 from unnest(p_keys) k where k not like 'pix:%') then
    raise exception 'Invalid payment key';
  end if;
  case p_operation
  when 'GET' then
    select value into v from public.criesuaia_payment_store where key=p_keys[1];
    return to_jsonb(v);
  when 'SET' then
    insert into public.criesuaia_payment_store(key,value) values(p_keys[1],p_values[1])
      on conflict(key) do update set value=excluded.value,updated_at=now();
    return to_jsonb('OK'::text);
  when 'CLAIM' then
    insert into public.criesuaia_payment_store(key,value) values(p_keys[1],p_values[1]) on conflict do nothing;
    get diagnostics inserted=row_count;
    return case when inserted=1 then to_jsonb('OK'::text) else null end;
  when 'SAVE' then
    insert into public.criesuaia_payment_store(key,value) values(p_keys[1],p_values[1]),(p_keys[2],p_values[2])
      on conflict(key) do update set value=excluded.value,updated_at=now();
    return to_jsonb(1);
  when 'REJECT' then
    insert into public.criesuaia_payment_store(key,value) values(p_keys[2],p_values[2])
      on conflict(key) do update set value=excluded.value,updated_at=now();
    delete from public.criesuaia_payment_store where key=p_keys[1] and value=p_values[1];
    return to_jsonb(1);
  when 'PAID' then
    select value into v from public.criesuaia_payment_store where key=p_keys[1] for update;
    if not found then return to_jsonb(-1); end if;
    j=v::jsonb;
    if j->>'status'='paid' then return to_jsonb(0); end if;
    j=j||jsonb_build_object('status','paid','paidAt',p_values[1]);
    update public.criesuaia_payment_store set value=j::text,updated_at=now() where key=p_keys[1];
    return to_jsonb(1);
  else raise exception 'Invalid payment operation';
  end case;
end $$;
revoke execute on function public.criesuaia_payment_command(text,text[],text[]) from public,anon,authenticated;
grant execute on function public.criesuaia_payment_command(text,text[],text[]) to service_role;
