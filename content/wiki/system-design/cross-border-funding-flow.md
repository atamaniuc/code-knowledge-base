---
slug: cross-border-funding-flow
title: Designing a cross-border funding flow
lang: en
domain: system-design
topic: payments
tech:
  name: Cross-border payment rails
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Moving money between countries combines every hard problem at once: two ledgers that do
  not talk, a rate that is promised before it is known, a compliance hold that can stop a
  payment after the customer believes it succeeded, and settlement measured in days.
prerequisites: [payment-lifecycle, double-entry-ledgers, reconciliation-and-drift]
related: [payment-lifecycle, idempotency-and-once-only-effects, reconciliation-and-drift, kyc-aml-and-audit-trails]
sources:
  - title: "Stripe — Cross-border payouts"
    url: https://docs.stripe.com/connect/cross-border-payouts
    kind: official-docs
  - title: "Stripe — Receive payouts"
    url: https://docs.stripe.com/payouts
    kind: official-docs
  - title: "FinCEN — Customer Due Diligence final rule"
    url: https://www.fincen.gov/resources/statutes-and-regulations/cdd-final-rule
    kind: official-docs
  - title: "ICC — Trade finance"
    url: https://iccwbo.org/business-solutions/trade-finance/
    kind: official-docs
review_status: draft
---

## The scenario

A platform in one country must pay a recipient in another, in the recipient's currency,
with a rate the sender was quoted, within a time the sender was told. Somebody has to be
responsible for the money in the gap between the two currencies and the two banking
systems, and that somebody is the design.

The answer is not a list of services. It is a walk through the lifecycle of one payment,
naming at each step what is guaranteed, what can fail, and who owns the difference. That is
what a system-design interviewer is scoring.

## Where the money actually moves

There are two ledgers and at least three clocks. The sending side debits the sender and
credits a liability to the recipient — money the platform now owes. The receiving side pays
out of a local account in the destination currency. Between them sits a treasury position:
liquidity in each currency, moved by the platform's own funding operations.

The clocks are the sender's payment (immediate), the payout rail (minutes to days), and the
treasury's settlement (the funding that keeps the local account liquid). Confusing the
clock the customer sees with the clock the money moves on is the first way a design goes
wrong: the platform has made a loan, at its own risk, from the instant it credits the
recipient until the payout settles.

The design decision to state early is therefore the liquidity model — prefunded local
accounts, a partner bank, a payout provider, or a mixture — because it determines the risk
the platform carries and the products it can honestly offer.

## The critical path and its states

Model the transfer as an explicit state machine, and make every transition idempotent and
auditable. A workable set: quoted, awaiting funding, funds received, compliance hold,
in review, approved, payout initiated, payout settled, completed, failed, refunding,
refunded. Each transition has an actor, a reason and a timestamp.

Two states deserve emphasis. In review is not an error state; it is a normal outcome of
screening, and the product must be able to tell the customer what is happening without
promising a time it cannot keep. And refunding is a first-class path, because a transfer
that cannot be paid out must return the money with the same discipline it was taken.

The rate is locked at quote and must be stored on the transfer with its source and its
expiry. Never recompute a rate after the fact; the stored value is the contract and the
recomputation is how reconciliations acquire unexplained differences.

## FX and the rate you promised

Foreign exchange introduces a position and therefore risk. When the platform quotes a rate
and takes the customer's money, it has sold currency forward in effect. The treasury
function must either hedge, offset against opposite flows, or hold the risk deliberately
with a limit.

For the engineer, three things follow. The quote is an entity with an expiry, stored with
the rate, the source and the spread, and referenced by the transfer. The ledger records
both legs — the amount the customer paid and the amount the recipient received — with the
rate, so the margin is derivable. And the platform needs to know its net position per
currency in near real time, which means the ledger must be queryable by currency, not only
by account.

## Compliance, limits and the hold

Cross-border flows attract sanctions screening, customer due diligence and corridor rules.
The uncomfortable property is that screening can stop a payment after the sender has been
told it was accepted. The design response is to make the promise honest: accept the money,
place the transfer in a review state, and communicate that outcome as a normal one.

Limits are enforced where the authoritative counter lives, with an explicit fail-closed
default for high-value corridors and a documented exception path. Every screening decision
and limit check is written to an append-only log with its inputs, because the question
comes back months later.

## Failure, compensation and reconciliation

Any step can fail after the previous one succeeded, so the design needs compensations, not
just retries. The pattern to name: a durable workflow or saga that records intent before
acting, retries idempotently, and on terminal failure runs the reverse steps — cancel the
payout, reverse the ledger entries, refund the sender — with the same audit trail.

The payout provider's statement is the external truth; the platform's ledger is the
internal one. Daily reconciliation matches transfers, payouts, fees and FX by reference and
alerts on every break, with categories and owners. The endpoint of the design is that the
platform can answer, for any transfer and any moment, where the money is, and prove it.

## What a staff answer adds

A named owner for the gap: liquidity, FX risk and the loan created between crediting the
recipient and settling the payout. Explicit guarantees per state, and a refusal to promise
a time the rails cannot deliver. Failure handled as a first-class path with refunds and
clear customer communication. Reconciliation and audit designed with the flow rather than
after the first incident. And the trade-offs named out loud: prefunding lowers risk and ties
up capital; per-transaction partners widen coverage and add latency and fees; a single
corridor done well beats ten done approximately.
