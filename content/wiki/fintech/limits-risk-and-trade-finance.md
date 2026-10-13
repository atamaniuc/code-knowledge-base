---
slug: limits-risk-and-trade-finance
title: Limits, risk checks and trade finance basics
lang: en
domain: fintech
topic: risk
tech:
  name: Payment risk controls
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  Limits and risk checks are the controls that decide whether a movement is allowed before
  it happens, and the audit trail is what proves the decision later. Trade finance is the
  same machinery applied to goods in transit, where the instruments have names an
  engineering interview expects you to recognise.
prerequisites: [payment-lifecycle, kyc-aml-and-audit-trails]
related: [kyc-aml-and-audit-trails, double-entry-ledgers, reconciliation-and-drift]
sources:
  - title: "Stripe — Receive payouts"
    url: https://docs.stripe.com/payouts
    kind: official-docs
  - title: "ICC — Trade finance"
    url: https://iccwbo.org/business-solutions/trade-finance/
    kind: official-docs
  - title: "Stripe — Disputes and chargebacks"
    url: https://docs.stripe.com/disputes
    kind: official-docs
review_status: draft
---

## Limits are a control, not a feature

A limit is a rule that constrains an action: this customer may move at most this much per
transaction, per day, per month; this merchant may hold at most this exposure; this corridor
may process at most this volume before a human looks. Limits exist because the cost of a
mistake is asymmetric — a fraudulent payment is hard to reverse and a credit loss may be
permanent.

The interview distinction is between a limit checked in the request handler and a limit
enforced by the system that owns the value. A limit that two services check by reading a
stale cache is not a limit; it is an aspiration. Enforcement belongs wherever the
authoritative counter lives, with the same transactional discipline as the money movement
it guards.

## The layers of a risk check

A defensible design checks several things in order, from cheap and absolute to expensive and
probabilistic.

Eligibility: is this customer verified, is this corridor open, is this instrument supported.

Hard limits: per-transaction, per-period, and cumulative exposure, evaluated against
authoritative counters that are updated atomically with the movement or reserved before it.

Velocity and pattern: too many attempts, too fast, from a new device or a new geography.
These are heuristics and they should be treated as such — a signal that raises friction,
not a verdict.

Fraud and sanctions screening: lists and models, with a decision that is recorded and
explainable.

Manual review: the escape hatch for the cases the rules cannot decide, with an SLA and an
owner. A queue nobody watches is the same as no queue.

The staff-level point is ordering and failure behaviour. If the risk service is down, does
the payment fail open or closed, and who made that decision? The answer is different for a
ten-unit payment and a ten-million-unit one, and it must be written down.

## Audit trails as a data model

Every limit decision and every risk outcome must be recorded: the rule and its version, the
inputs, the decision, the actor, and the timestamp. This is what lets a customer dispute be
answered, lets a regulator's question be resolved, and lets the team learn which rules
produce false positives.

The practical design is an append-only decision log, keyed by the business reference, that
can be joined to the ledger entry. A decision that exists only in a log line without the
inputs cannot be explained later, and a decision stored only as a boolean cannot be tuned.

## Trade and supply-chain finance

Trade finance exists because a cross-border sale of goods has a timing problem. The exporter
does not want to ship before being paid; the importer does not want to pay before receiving
goods. For centuries the gap has been bridged by documents rather than by trust, and the
banking system's job is to make the documents negotiable.

The classic instrument is the letter of credit: the importer's bank promises to pay the
exporter against a defined set of documents presented by a deadline. The bank's promise
substitutes for the importer's credit, which is why the documents matter so much — payment
is against documents, not against goods. Documentary collections are the lighter-weight
version, where the bank handles the documents but does not add its own undertaking.

Supply-chain finance, also called reverse factoring, is the modern working-capital product:
a large buyer approves an invoice, and a financier pays the supplier early at a discount,
collecting from the buyer at the original due date. The buyer's credit quality, not the
supplier's, prices the transaction, which is the whole point.

## The instruments an engineer meets

The vocabulary a sector posting assumes: the bill of lading is the document of title for
goods in transit; a documentary credit is the letter of credit's formal name; the UCP 600
is the ICC's rulebook that defines how documentary credits are examined and honoured;
Incoterms define who bears cost and risk at each stage of the journey; and a presentation is
the set of documents submitted for payment.

For an engineer building in this space, the shape is familiar. Documents are the events,
rules determine whether a presentation is compliant, deadlines create timeouts, and the
system of record must be immutable because the instruments are negotiable and their history
is evidence. The added twist is that the workflow is multi-party by design — exporter,
importer, two banks, a carrier, an insurer — so the platform is a coordination system with
a ledger attached, and the hard part is agreeing on state between parties who do not trust
each other.

## What a staff answer adds

Limits enforced where the counter lives, with an explicit fail-open or fail-closed decision
per product. Risk decisions as versioned, explainable records joined to the ledger. A clear
statement of what the platform guarantees to each counterparty and what it merely observes.
And for trade finance, the recognition that the goods and the documents can disagree, so
reconciliation is not optional — it is the product.
