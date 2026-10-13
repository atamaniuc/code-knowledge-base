---
slug: reconciliation-and-drift
title: Reconciliation and how drift is detected
lang: en
domain: fintech
topic: operations
tech:
  name: Reconciliation systems
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  A ledger is internally consistent by construction, which is exactly why it cannot prove
  itself right. Reconciliation compares it against an external statement of truth, and the
  engineering is in the matching rules, the break taxonomy and the alerting on aging
  breaks.
prerequisites: [double-entry-ledgers]
related: [double-entry-ledgers, idempotency-and-once-only-effects, payment-lifecycle]
sources:
  - title: "Stripe — Receive payouts"
    url: https://docs.stripe.com/payouts
    kind: official-docs
  - title: "Stripe — Disputes and chargebacks"
    url: https://docs.stripe.com/disputes
    kind: official-docs
review_status: draft
---

## What reconciliation is

Internal consistency is not correctness. A ledger can balance perfectly while the money is
somewhere else than the system believes: a charge the provider never captured, a payout
short by a fee, a refund issued twice, a bank that settled a different amount. The only
way to find out is to compare two independently produced records of the same events.

So reconciliation is the process of matching the internal ledger against an external
statement — a settlement file from the card network, a bank statement, a provider's
balance report — and accounting for every difference. The interview question is usually
disguised as an operational one: how do you know the numbers are right? The answer is that
you compare, continuously, and that you have a place for the differences to live.

## Two sources of truth

Name both sides and their properties. The internal journal is under your control, written
transactionally, and updated in real time. The external statement is authoritative,
delivered on someone else's schedule, and often arrives as a file with a settlement date
rather than a timestamp — daily batches, T+1 or T+2 cycles, a monthly bank statement.

The asymmetry is the source of most difficulty. The external side is authoritative but
late; the internal side is timely but not evidence. Reconciliation is the bridge, and the
delay is why a break appearing today may be yesterday's timing rather than an error.

## Matching

Matching is the core algorithm, and it is usually not a single key. Deterministic keys
first: the provider's charge id, the payout id, the bank reference. Where no shared id
exists, a composite key of amount, currency, date window and counterparty narrows the
candidate set. Only after that does fuzzy matching have a role, and fuzzy matching must
propose rather than auto-accept, because a false match silently hides a real break.

The output of matching is three sets: matched pairs, items only on the internal side, and
items only on the external side. Every item must be accounted for — an unmatched item is a
break with an owner, not a row in a report nobody reads.

## The taxonomy of breaks

Naming the categories is what makes the answer senior. Timing: the event exists on both
sides but in different periods, which resolves itself. Missing: present on one side only,
which is either a lost write or a delay. Duplicate: the same event recorded twice, usually
a retry that was not idempotent. Amount or fee: the amounts differ, often an undisclosed
fee or an FX spread. Reversal: a refund or chargeback that the ledger has not yet applied.
Rounding: a currency or split artefact.

Each category has a different severity and a different resolution. Timing breaks are
expected and age out; duplicate and missing breaks are defects with a fix; amount breaks
may be contract disputes. A reconciliation system that reports a single total difference
has thrown away the information needed to act.

## Detection and alerting

The metrics that matter are not the number of matched items. They are: break count by
category, the age of the oldest open break, and the freshness of the last successful
reconciliation run. A reconciliation that has not run is indistinguishable from one that
found nothing, so the job's own liveness is the first alert.

Alert on change, not on absolute counts, for the noisy categories, and page on the
categories that indicate a defect: duplicates, missing items past their expected lag, and
amount breaks above a threshold. The uncomfortable but correct position is that an
unexplained break is an incident, not a ticket.

## Resolution and evidence

Every break needs a disposition: auto-resolved by a matching rule, corrected by a
compensating ledger entry, written off with an approval, or escalated. The disposition and
its evidence — the statement line, the provider reference, the approver — are stored with
the break, because an auditor will ask why the difference was accepted.

The loop closes when a break category is eliminated by a code change rather than by
manual adjustment. A team that reconciles by adjusting the ledger every day has automated
the symptom.

## What a staff answer adds

Reconciliation designed in rather than bolted on: the ledger emits the events the matcher
needs, with stable references, and the statement ingestion is idempotent because statements
get reprocessed. Breaks are first-class records with owners and SLAs. The system can answer
what a customer's true position is at any past moment, and it can prove it against the
provider. And the accepted failure is stated: settlement lag means today's numbers are an
estimate, and the business is told which numbers are provisional.
