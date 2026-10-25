-- quote_counter is changed only by next_quote_number(): users may update every other
-- profile column, so they cannot reset or rewind their own quote numbers.
revoke update on public.profiles from authenticated, anon;
grant update (business_name, vat_number, address, phone, email, logo_path, price_overrides,
  box_presets) on public.profiles to authenticated;

-- Security definer, since callers no longer hold UPDATE on quote_counter. It still only
-- touches the caller's own row (auth.uid()).
create or replace function public.next_quote_number() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_number integer;
begin
  update public.profiles set quote_counter = quote_counter + 1
   where user_id = auth.uid()
  returning quote_counter into v_number;
  if v_number is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return v_number;
end;
$$;

revoke execute on function public.next_quote_number from anon, public;
grant execute on function public.next_quote_number to authenticated;
