CREATE OR REPLACE FUNCTION public.sync_bet_tracker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := COALESCE(NULLIF(NEW.bet_tracker, ''), 'LSL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)));
  END IF;
  NEW.bet_tracker := NEW.tracking_id;
  RETURN NEW;
END;
$function$;

UPDATE public.bets
SET bet_tracker = tracking_id
WHERE bet_tracker IS DISTINCT FROM tracking_id;

ALTER TABLE public.bets
ALTER COLUMN bet_tracker DROP DEFAULT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'bet_selections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.bet_selections;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'support_tickets'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ticket_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_messages;
  END IF;
END $$;