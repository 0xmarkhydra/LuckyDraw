# Candy Match — business rules and acceptance cases

## Campaign lifecycle
- Draft: choose immutable game type, configure title, schedule, 60/90/120s, optional ranking prizes.
- Publish: only admit a player if a full round fits before the configured end.
- Pause: block new starts; existing sessions keep their original expiry.
- Close: pause or scheduled end, wait for every session to expire, then explicitly finalize.
- Finalized: permanent, cannot reopen or modify prize tiers, timing or schedule. Rankings do not depend on a scheduled background job.
- Prize tiers and duration cannot change after the first real player joins. Changes before the first player require pause.

## Player and ranking rules
- Normalize Vietnamese mobile number to E.164; one real session per phone per campaign. No OTP in current release: phone ownership is not established.
- UUID is a bearer session capability; same-tab reload restores it from sessionStorage. No recovery across device/browser or cleared storage without identity verification.
- Server chooses board and RNG, calculates points from adjacent swaps, sequence and expiry; client cannot directly submit score. Unsuccessful swaps do not earn points.
- Timer continues during network loss, hidden tab or pause. Retries recover authoritative board and score; no additional time. No offline scoring.
- Points: 10 per cleared piece times cascade multiplier. Only completed sessions rank; higher score first, earlier attainment next, UUID deterministic fallback.
- Public leaderboard masks phone, distinguishes temporary vs finalized rank, never returns voucher codes. Refresh periodically while page visible; result has manual refresh.
- Fairness limitations: random initial boards differ; automated solvers and varying network delays can affect competitive results. High-value prizes require additional anti-bot/OTP and contest rules.

## Rewards
- Optional 1–1000 rank ranges, max 50 groups, no overlap. If using unique voucher codes, exactly one per rank in range and no duplicates across groups. Empty codes means non-code reward.
- 0 points does not qualify. Fewer eligible players leaves unused codes unallocated. No reallocation or replacement after settlement.
- Finalization transaction locks campaign and sessions, rejects active campaign or incomplete rounds, assigns prize and codes deterministically, is idempotent.
- Owner sees full phone/code in admin and exports; manual identity verification and delivery (no automatic SMS). Mark delivered only after verification and handover; repeat is idempotent. Public winner sees prize name and delivery state but not code.
- Excel export includes completed rows at a fixed cutoff (50,000-row cap). During live campaign it is provisional; final export is stable for ranking, delivery state may later update.

## Acceptance cases
| Case | Expected |
| --- | --- |
| Start same phone twice, including concurrent calls | One session only; retry of same UUID restores |
| Refresh same tab / interrupted move | Restore server board, seq, score, original expiry |
| Send forged score, invalid swap, stale seq | Reject or ignore; server recalculates |
| End close to start | Reject unless full duration remains |
| Pause during a round | Existing round finishes, no new starts |
| Overlapping tier, duplicate or missing voucher | Reject config |
| Change reward after first player | Reject |
| Finalize before last round ends | Reject |
| Same score | Earlier score_at wins; deterministic fallback |
| 0 score / fewer players than prizes | No award for zero; unused codes not allocated |
| Finalize twice / deliver twice | No duplicate awards |
| Reopen finalized | Reject |
| Different account accesses report or export | 404; no data leakage |
| Public leaderboard/session response | Masked phones; no voucher or RNG |
| Existing wheel | No change to draw odds or inventory |
| Browser/mobile, widget, load | Requires live end-to-end acceptance testing |

## Still outstanding
- OTP or equivalent identity verification, bot detection and competition-grade fairness.
- Phone ownership verification before any self-service claim, lost-session recovery across devices.
- Native brand assets, advanced tile animations/audio, unified design system and analytics.
- Campaign archive/clone, detailed claim/disqualification/reallocation workflow, export/audit permissions and high-volume load test.
