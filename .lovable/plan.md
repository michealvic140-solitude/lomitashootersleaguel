## Scope

This is a very large request — essentially a full second-pass overhaul of the platform plus a long list of new features. To avoid burning your credits on guesswork, I want to lock in scope and order before I start coding. Below is the plan grouped by area, in priority order. Each numbered group is one shippable phase.

---

### Phase 1 — Critical bet ticket + checkout fixes (PRIORITIZE)
1. **Non-blocking BetSlip checkout.** Replace the auto-opening drawer with a floating mini-pill (e.g. "3 selections · ₦x potential") that the user taps when they're ready. Selecting an odd just updates the counter — never steals focus.
2. **Booking code reusability.** Add a "Load booking code" input on `/checkout` and the BetSlip drawer that hydrates another user's selections from `bets.booking_code` (read-only, stake editable).
3. **Luxury BetSlip ticket UI.** Gradient surfaces tied to server color, glassmorphism card, refined typography, status chip, copy/share/QR for booking code, animated payout. Applied to drawer preview, `/ticket/$id`, and dashboard ticket cards.

### Phase 2 — Ticket Tracker (admin) + reports
4. **Admin "Ticket Tracker" panel.** Paste tracking ID or booking code → load ticket → actions: void a single selection, suspend/flag whole ticket, mark refunded (refunds stake), delete with reason. Wire to existing `admin_suspend_bet`, `admin_unsuspend_bet`, `admin_delete_bet` RPCs + new `admin_void_selection` and `admin_refund_bet` RPCs. Each action triggers a user notification.
5. **Live feed of all bets.** Searchable/filterable table (open / suspended / won / lost / refunded) with realtime updates.
6. **Admin Support Ticket panel.** Dedicated page listing `support_tickets` with unread red badge, image upload (user + admin replies via `ticket-uploads` bucket), open/close/delete actions, realtime new-message indicator on the admin nav chat/ticket icon.

### Phase 3 — Sponsor role + promo request flow
7. **Sponsor dashboard card.** Visible only to users with `sponsor` role. Form posts to `promo_code_requests`. Non-sponsors see a locked card with "Request sponsor role" CTA.
8. **Admin "Promo Requests" panel.** List pending/approved/declined, approve (calls `approve_promo_request`) or decline with note.
9. **Promo code analytics.** Per-code log: created_by, usage_limit, used_count, list of redeemers (full name + timestamp) using `promo_redemptions`.

### Phase 4 — Live admin controls for matches
10. **Live score editor** in admin matches panel — editable while status = `live`, broadcasts via realtime so users see updates.
11. **Live odds editor** — editable while live; existing `bet_selections.locked_odds` remain unchanged for placed tickets.
12. **Delete featured + main matches** with confirm modal.
13. **Featured matches carousel on home** — auto-sliding + manual arrows, multi-select in admin.
14. **Categories on homepage** — fix query so categories with matches render (currently filtered out).

### Phase 5 — Dashboard + auth/profile
15. **User dashboard redesign** with cards: Bet Tickets, Edit Profile, Withdrawal, Deposit (Coming Soon), Request Tokens, Request Promo Code (sponsor-only), Tasks (Coming Soon), Achievements (Coming Soon), Transaction History, Audit Logs.
16. **Transaction history + audit log views** with full detail and timestamps from `token_transactions` and `audit_logs`.
17. **Withdrawal request — image upload** (proof) into `ticket-uploads` bucket.
18. **Registration form update**: in-game name, email, phone, country, server, Discord full name, Discord username (required), gang/faction selector + name.
19. **Banned-user kick + appeal flow**: realtime listener on `profiles.is_banned` → sign out + glass appeal card on login screen routing to `/support` appeal form.
20. **Persistent session on refresh** — fix the dashboard re-login bug by gating the loader on `supabase.auth.getUser()` in `beforeLoad`.

### Phase 6 — Admin UX overhaul
21. **Admin shell redesign** — luxury sidebar, glass cards, gradient accents, consistent spacing. Same treatment for User Management, Settings.
22. **Clickable user row** → modal/panel with tabs: Profile, Transactions, Audit Logs, Tokens, Roles, Actions, Bet Slips.
23. **Realtime analytics** on admin dashboard — line/bar charts for revenue, bets, signups (recharts) instead of plain numbers.
24. **Surface hidden admin features** — anything currently only callable via SQL gets a UI entry.
25. **Admin AI panel** — placeholder "Coming Soon" card.
26. **Glassmorphism confirm modal** — replace every `window.confirm` and native alert across admin + user flows. Reuse the existing `ConfirmDialog` provider, restyled.

### Phase 7 — Misc
27. **Chat unread red dot** on the chat nav icon, realtime via `chat_messages` subscription.
28. **Repo audit pass** against `https://github.com/michealvic140-solitude/lslonlinebetting` to pull any feature still missing.

---

### Technical notes (for me)

- New migrations needed: `admin_void_selection(bet_selection_id, reason)`, `admin_refund_bet(bet_id, reason)`, `support_tickets` realtime publication, `promo_redemptions` view with profile join, `unread_count` helper for support tickets.
- New components: `LuxuryTicketCard`, `BookingCodeLoader`, `MiniSlipPill`, `AdminTicketTracker`, `AdminSupportTicketPanel`, `PromoRequestCard` (sponsor + admin), `LiveScoreEditor`, `LiveOddsEditor`, `FeaturedCarousel`, `BannedAppealCard`, `RealtimeAnalytics`, `GlassConfirm`.
- Hidden admin SQL surfaces to expose: `wipe_all_tokens`, manual token credits via `token_transactions` insert, `review_withdrawal_request`, `admin_*_bet`, promo creation.
- Storage: reuse `ticket-uploads` (already public) for withdrawal proofs and support-ticket attachments.

---

### How I want to proceed

This is roughly **6–8 build cycles** of work. To keep your credits sane and let you steer, I'll ship it in the phases above (1 → 7), pausing between phases so you can verify in the preview. **Phase 1 first** unless you reorder.

**Reply with one of:**
- **"Go"** → I start Phase 1 immediately and continue through phases sequentially.
- **"Reorder: 4, 2, 1, …"** → I'll follow your order.
- **"Only do X, Y"** → I'll scope down to just those phases.
