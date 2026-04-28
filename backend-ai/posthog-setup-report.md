<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Waitlist Management FastAPI backend. This session supplemented the existing integration with three additional events and fixed a `requirements.txt` formatting issue.

## Summary of changes

- **`backend-ai/app/requirements.txt`** — Fixed malformed entry (`supabase==2.11.0posthog` → `supabase==2.11.0` + `posthog` on separate lines).
- **`backend-ai/.env`** — Updated `POSTHOG_API_KEY` and `POSTHOG_HOST` to correct values (covered by `.gitignore`).
- **`backend-ai/app/main.py`** — Added three new event captures:
  - Replaced `app.add_exception_handler` with a `_tracking_error_handler` wrapper that fires `auth failed` on 401 responses.
  - `sync_endpoint` now captures `sync completed` with device and operation metadata.
  - `ping_activity` now captures `guest activity pinged` to track guest engagement signals.

## Tracked events

| Event name | Description | File |
|---|---|---|
| `staff logged in` | Staff member authenticated via the login endpoint | `backend-ai/app/main.py` |
| `waitlist entry viewed` | A guest looked up their waitlist entry status | `backend-ai/app/main.py` |
| `dashboard viewed` | Staff viewed the event dashboard | `backend-ai/app/main.py` |
| `sync completed` | Staff device completed an offline sync operation | `backend-ai/app/main.py` |
| `guest activity pinged` | Guest confirmed they are still active and waiting | `backend-ai/app/main.py` |
| `auth failed` | Authentication attempt failed (401) | `backend-ai/app/main.py` |
| `event created` | A new waitlist event was created by staff | `backend-ai/app/services.py` |
| `waitlist joined` | A guest joined the waitlist for an event | `backend-ai/app/services.py` |
| `guest promoted` | One or more queued guests were promoted to NOTIFIED status | `backend-ai/app/services.py` |
| `guest seated` | A guest was successfully seated from the waitlist | `backend-ai/app/services.py` |
| `guest marked no show` | A queued or notified guest was marked as a no-show | `backend-ai/app/services.py` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics:** https://us.posthog.com/project/400745/dashboard/1518781
- **Guest conversion funnel (joined → promoted → seated):** https://us.posthog.com/project/400745/insights/7GAQzMXf
- **Waitlist joins over time:** https://us.posthog.com/project/400745/insights/VssCEnQ3
- **No-show rate vs. seatings (churn signal):** https://us.posthog.com/project/400745/insights/m9PxojT8
- **Staff activity overview:** https://us.posthog.com/project/400745/insights/mX966Z2n
- **Auth failures over time:** https://us.posthog.com/project/400745/insights/Dd78mkOj

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-fastapi/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
