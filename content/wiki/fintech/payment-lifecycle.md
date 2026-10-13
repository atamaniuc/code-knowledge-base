---
slug: payment-lifecycle
title: The payment lifecycle from authorisation to chargeback
lang: en
domain: fintech
topic: payments
tech:
  name: Stripe API
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Money does not move in one step. A payment is authorised, possibly captured later,
  refunded, settled through a payout, and sometimes reversed months later by a chargeback.
  Each stage has its own state, its own failure, and its own clock.
prerequisites: [double-entry-ledgers, idempotency-and-once-only-effects]
related: [double-entry-ledgers, reconciliation-and-drift, idempotency-and-once-only-effects]
sources:
  - title: "Stripe — How Payment Intents and Setup Intents work"
    url: https://docs.stripe.com/payments/paymentintents/lifecycle
    kind: official-docs
  - title: "Stripe — Place a hold on a payment method"
    url: https://docs.stripe.com/payments/place-a-hold-on-a-payment-method
    kind: official-docs
  - title: "Stripe — Refund and cancel payments"
    url: https://docs.stripe.com/refunds
    kind: official-docs
  - title: "Stripe — Disputes and chargebacks"
    url: https://docs.stripe.com/disputes
    kind: official-docs
review_status: draft
---

## The states a payment passes through

A payment is a state machine, and the states are the vocabulary an interview checks. In a
modern payment API the object moves through requiring a payment method, requiring
confirmation, requiring an action such as a 3D Secure challenge, processing, and then a
terminal state: succeeded, or requiring capture if the merchant chose to authorise and
capture separately. A payment that is never completed moves to canceled.

The single most common mistake is treating a payment as a boolean. A payment that is
processing is not paid, a payment that is authorised is not captured, and a payment that
succeeded six months ago can still be reversed. Every integration decision follows from
which of those states the system is allowed to treat as money in hand.

## Authorisation and capture

Authorisation reserves funds on the customer's payment method and carries an expiry. Manual
capture, sometimes called placing a hold, separates that reservation from taking the money
— hotels authorising the full stay at check-in and capturing at checkout are the canonical
example. The capture must happen before the authorisation expires; if it does not, the
funds are released and the payment moves to canceled.

The expiry is not uniform, which is why it belongs in an answer rather than a footnote. The
window depends on the card brand and on whether the transaction is customer-initiated or
merchant-initiated: the documented card-not-present windows run from about five days for
Visa merchant-initiated to seven days for most customer-initiated cases, and card-present
windows are shorter. A system that treats the hold as valid for a fixed fortnight will
silently lose authorisations, and the symptom appears as a capture failure long after the
code that caused it shipped.

Two engineering consequences follow. Track the expiry per authorisation and act before it,
with a scheduled capture or a cancellation that the customer is told about. And make the
capture idempotent, because a retried capture is the classic way to attempt the same hold
twice.

## Refunds

A refund reverses a captured payment, fully or partially. Three properties matter for
design. It may take a fee: the original processing fee is generally not returned, so a
refund is not a clean undo. It uses available balance rather than pending funds, and if the
balance does not cover it the refund can sit pending until it does. And it is asynchronous
relative to the customer's bank — the refund shows on the statement in a time determined by
the network and the issuer, not by the API response.

Cancelling before capture is different from refunding after: it is cheaper and it is not a
refund at all, it is the release of a reservation. A support tool that offers one button
labelled refund will get this wrong on the merchant's behalf.

## Settlement and payout

Capture is not settlement. Settlement is the movement of funds between the parties —
acquirer to merchant, network fees deducted, foreign exchange applied — and it lands in the
merchant's balance on the provider's schedule. Payouts then move the available balance to a
bank account: a first payout typically takes one to two weeks depending on industry, country
and risk, and subsequent payouts follow the account's payout schedule, with the bank adding
its own delay.

The engineering point is that there are at least three clocks in the system: the
authorisation clock, the settlement clock, and the payout clock. A ledger entry is created
when the business event happens, but the funds are not necessarily available, and a product
that lets a merchant spend against unsettled funds has made a credit decision whether it
meant to or not.

## Chargebacks and disputes

A chargeback starts with the cardholder's issuer, not with the merchant. The cardholder
questions the payment, the issuer raises a formal dispute on the card network, and the
payment is reversed immediately — the amount and one or more network dispute fees are taken
from the provider's balance and debited from the merchant. The merchant then has a window to
respond with evidence, and the outcome is decided by the network's rules and reason codes,
not by the platform.

Three design consequences. Disputes are asynchronous and arrive long after the payment, so
the data needed to defend one must be retained for the dispute window — receipts,
delivery proof, the authentication result. A chargeback is not a refund: it is a reversal
plus fees, and it must post to the ledger as its own event so the numbers reconcile.
And the dispute rate is a monitored metric with network programmes attached, so
excessive disputes become an existential problem rather than a customer-service one.

## Where the engineering lives

Every stage is an asynchronous event that must be consumed idempotently and posted to the
ledger exactly once. Webhooks arrive out of order and more than once; the state machine must
tolerate a late authorisation event after a capture, and a dispute for a payment whose
refund is still settling. The safe pattern is to treat each provider event as a fact with an
id, apply it idempotently, and let the ledger — not the latest webhook — be the truth.

## What a staff answer adds

A map of the states and the money at each: nothing has moved at authorisation, funds are
committed at capture, funds are available at settlement, funds are in the bank at payout.
Idempotency at every transition and a reconciliation that compares the provider's balance to
the ledger daily. Retention aligned to the dispute window rather than to convenience. And a
stated policy for the awkward cases — partial capture, capture after expiry, refund of a
disputed payment — because those are where the support tickets and the write-offs come from.
