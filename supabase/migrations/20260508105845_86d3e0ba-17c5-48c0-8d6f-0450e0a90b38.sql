
-- One open bet per match per user
CREATE OR REPLACE FUNCTION public.enforce_one_open_bet_per_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid;
  existing_count int;
BEGIN
  IF NEW.match_id IS NULL THEN RETURN NEW; END IF;
  SELECT user_id INTO uid FROM public.bets WHERE id = NEW.bet_id;
  IF uid IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO existing_count
  FROM public.bet_selections bs
  JOIN public.bets b ON b.id = bs.bet_id
  WHERE bs.match_id = NEW.match_id
    AND b.user_id = uid
    AND b.status IN ('open','suspended')
    AND bs.bet_id <> NEW.bet_id;
  IF existing_count > 0 THEN
    RAISE EXCEPTION 'You already have an active ticket on this match. Each match can only be staked once until it settles.';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_one_open_bet_per_match ON public.bet_selections;
CREATE TRIGGER trg_one_open_bet_per_match
AFTER INSERT ON public.bet_selections
FOR EACH ROW EXECUTE FUNCTION public.enforce_one_open_bet_per_match();

-- Promo code requests
CREATE TABLE IF NOT EXISTS public.promo_code_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  usage_limit integer NOT NULL DEFAULT 1 CHECK (usage_limit > 0),
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
  generated_code text,
  promo_id uuid,
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promo_code_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sponsors create own requests" ON public.promo_code_requests;
CREATE POLICY "sponsors create own requests"
ON public.promo_code_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'sponsor'));

DROP POLICY IF EXISTS "users see own promo requests" ON public.promo_code_requests;
CREATE POLICY "users see own promo requests"
ON public.promo_code_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins update promo requests" ON public.promo_code_requests;
CREATE POLICY "admins update promo requests"
ON public.promo_code_requests FOR UPDATE TO authenticated
USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "admins delete promo requests" ON public.promo_code_requests;
CREATE POLICY "admins delete promo requests"
ON public.promo_code_requests FOR DELETE TO authenticated
USING (public.is_admin(auth.uid()));

-- Approve promo request → creates a real promo code
CREATE OR REPLACE FUNCTION public.approve_promo_request(_id uuid, _note text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record; new_code text; new_promo uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM public.promo_code_requests WHERE id = _id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;
  new_code := 'LSL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO public.promo_codes(code, amount, usage_limit, used_count, is_active, created_by)
    VALUES (new_code, r.amount, r.usage_limit, 0, true, auth.uid())
    RETURNING id INTO new_promo;
  UPDATE public.promo_code_requests
    SET status='approved', generated_code=new_code, promo_id=new_promo,
        admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_id;
  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (r.user_id, 'Promo code approved',
      'Your promo code request was approved. Code: '||new_code||' · '||r.amount||' tokens · '||r.usage_limit||' uses.',
      '/dashboard');
  RETURN new_promo;
END $$;

CREATE OR REPLACE FUNCTION public.decline_promo_request(_id uuid, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE r record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO r FROM public.promo_code_requests WHERE id = _id FOR UPDATE;
  IF r IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Already reviewed'; END IF;
  UPDATE public.promo_code_requests
    SET status='declined', admin_note=_note, reviewed_by=auth.uid(), reviewed_at=now()
    WHERE id=_id;
  INSERT INTO public.notifications(user_id, title, body)
    VALUES (r.user_id, 'Promo code request declined', COALESCE(_note,'Your promo code request was declined.'));
END $$;

-- Bet moderation
CREATE OR REPLACE FUNCTION public.admin_suspend_bet(_bet_id uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO b FROM public.bets WHERE id=_bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  UPDATE public.bets SET status='suspended' WHERE id=_bet_id;
  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (b.user_id, 'Ticket suspended',
      COALESCE(_reason,'Your bet ticket has been suspended by an admin.'),
      '/ticket/'||_bet_id);
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'suspend_bet', 'bet', _bet_id::text, jsonb_build_object('reason', _reason));
END $$;

CREATE OR REPLACE FUNCTION public.admin_unsuspend_bet(_bet_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  UPDATE public.bets SET status='open' WHERE id=_bet_id AND status='suspended';
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id)
    VALUES (auth.uid(), 'unsuspend_bet', 'bet', _bet_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_bet(_bet_id uuid, _refund boolean DEFAULT false, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO b FROM public.bets WHERE id=_bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF _refund THEN
    UPDATE public.profiles SET token_balance = token_balance + b.stake WHERE id = b.user_id;
  END IF;
  DELETE FROM public.bet_selections WHERE bet_id = _bet_id;
  DELETE FROM public.bets WHERE id = _bet_id;
  INSERT INTO public.notifications(user_id, title, body)
    VALUES (b.user_id, 'Ticket removed',
      COALESCE(_reason,'Your bet ticket has been removed by an admin.') ||
        CASE WHEN _refund THEN ' Stake refunded.' ELSE '' END);
  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'delete_bet', 'bet', _bet_id::text,
      jsonb_build_object('reason', _reason, 'refunded', _refund, 'stake', b.stake));
END $$;
