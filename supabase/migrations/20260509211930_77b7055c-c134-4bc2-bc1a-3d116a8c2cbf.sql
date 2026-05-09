
-- Void a single selection on a ticket. Marks selection as void, recomputes total odds & potential payout
CREATE OR REPLACE FUNCTION public.admin_void_selection(_selection_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sel record;
  b record;
  new_odds numeric;
  new_payout bigint;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO sel FROM public.bet_selections WHERE id = _selection_id FOR UPDATE;
  IF sel IS NULL THEN RAISE EXCEPTION 'Selection not found'; END IF;
  SELECT * INTO b FROM public.bets WHERE id = sel.bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;

  UPDATE public.bet_selections SET result = 'void' WHERE id = _selection_id;

  -- Recompute total odds (treat void as 1.0)
  SELECT COALESCE(EXP(SUM(LN(CASE WHEN result = 'void' THEN 1 ELSE locked_odds END))), 1)
    INTO new_odds
  FROM public.bet_selections WHERE bet_id = b.id;

  new_payout := FLOOR(b.stake * new_odds);

  UPDATE public.bets
    SET total_odds = new_odds, potential_payout = new_payout
    WHERE id = b.id;

  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (b.user_id, 'Selection voided',
      COALESCE(_reason, 'A selection on your ticket was voided. Odds and payout were recalculated.'),
      '/ticket/' || b.id);

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'void_selection', 'bet_selection', _selection_id::text,
      jsonb_build_object('reason', _reason, 'bet_id', b.id, 'new_odds', new_odds, 'new_payout', new_payout));
END $$;

-- Refund a whole bet ticket: credit stake back, mark bet as refunded (uses 'lost' status visual but settled), notify user
CREATE OR REPLACE FUNCTION public.admin_refund_bet(_bet_id uuid, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b record;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin only'; END IF;
  SELECT * INTO b FROM public.bets WHERE id = _bet_id FOR UPDATE;
  IF b IS NULL THEN RAISE EXCEPTION 'Bet not found'; END IF;
  IF b.status NOT IN ('open','suspended') THEN
    RAISE EXCEPTION 'Only open/suspended tickets can be refunded';
  END IF;

  UPDATE public.profiles SET token_balance = token_balance + b.stake WHERE id = b.user_id;
  UPDATE public.bets
    SET status = 'cashed_out', cashout_amount = b.stake, cashed_out_at = now(), settled_at = now()
    WHERE id = _bet_id;

  INSERT INTO public.notifications(user_id, title, body, link)
    VALUES (b.user_id, 'Ticket refunded',
      COALESCE(_reason, 'Your ticket has been refunded. Stake of ' || b.stake || ' tokens credited back.'),
      '/ticket/' || _bet_id);

  INSERT INTO public.audit_logs(actor_id, action, target_type, target_id, metadata)
    VALUES (auth.uid(), 'refund_bet', 'bet', _bet_id::text,
      jsonb_build_object('reason', _reason, 'stake', b.stake));
END $$;
