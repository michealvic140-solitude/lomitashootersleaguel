ALTER TABLE public.bets
ADD COLUMN IF NOT EXISTS bet_tracker text;

UPDATE public.bets
SET bet_tracker = tracking_id
WHERE bet_tracker IS NULL;

ALTER TABLE public.bets
ALTER COLUMN bet_tracker SET DEFAULT ('LSL-'::text || upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 10)));

CREATE UNIQUE INDEX IF NOT EXISTS bets_bet_tracker_key ON public.bets (bet_tracker);
CREATE INDEX IF NOT EXISTS bets_bet_tracker_search_idx ON public.bets (bet_tracker, booking_code, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_bet_tracker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.bet_tracker IS NULL OR NEW.bet_tracker = '' THEN
    NEW.bet_tracker := NEW.tracking_id;
  END IF;
  IF NEW.tracking_id IS NULL OR NEW.tracking_id = '' THEN
    NEW.tracking_id := NEW.bet_tracker;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_bet_tracker_before_insert ON public.bets;
CREATE TRIGGER sync_bet_tracker_before_insert
BEFORE INSERT ON public.bets
FOR EACH ROW
EXECUTE FUNCTION public.sync_bet_tracker();