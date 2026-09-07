# Work tracks

Index of live tracks (handoff-driven development). One line per track: essence — handoff —
status, date, next step. Statuses: `active` / `paused` (+ why) / `blocked` (+ on what).
Closed tracks are distilled into [TRACKS-LOG.md](TRACKS-LOG.md) and their handoffs deleted.

`make check` verifies this file through the shared harness: every link must resolve and
every line must carry a status. A line pointing at a handoff that no longer exists is a
dead marker the next session would trust.

Protocol: `AGENTS.md` → "Work tracks and handoffs".

- **Verification gates G2–G5** — none — paused (G1 shipped; the rest need the adversarial model wired), next: `verifier-adversarial` in the queue — an independent model asked to falsify each claim against the fetched sources
