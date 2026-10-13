---
slug: kyc-aml-and-audit-trails
title: KYC, AML and the audit trail an engineer builds
lang: en
domain: fintech
topic: compliance
tech:
  name: KYC and AML controls
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  A regulated product forces identity, monitoring and record-keeping into the data model.
  An engineer is not expected to interpret the regulation, but is expected to know what
  evidence must exist, how long it is kept, and why deletion requests and record retention
  collide.
prerequisites: [payment-lifecycle]
related: [double-entry-ledgers, limits-risk-and-trade-finance, reconciliation-and-drift]
sources:
  - title: "FinCEN — Customer Due Diligence final rule"
    url: https://www.fincen.gov/resources/statutes-and-regulations/cdd-final-rule
    kind: official-docs
  - title: "Stripe — Identity"
    url: https://docs.stripe.com/identity
    kind: official-docs
  - title: "Stripe — 3D Secure authentication"
    url: https://docs.stripe.com/payments/3d-secure
    kind: official-docs
review_status: draft
---

## Why an engineer has to know this

Compliance is usually presented as a legal problem, but the parts that fail are engineering
problems. The questions in an interview are practical: where does identity verification
happen, what is stored when a customer is screened, how long is a transaction record kept,
who can read it, and what happens when a customer asks to be deleted.

You are not expected to recite a regulation. You are expected to know the shape of the
controls and to design storage and access that make them possible. The US customer due
diligence rule is a useful reference because it states the obligations plainly, and because
it makes the data model concrete.

## KYC: who the customer is

Know Your Customer is the set of controls that establish and verify who you are doing
business with. The customer due diligence rule lists four core requirements that a covered
institution must have procedures for: identify and verify the identity of customers;
identify and verify the beneficial owners of legal entity customers; understand the nature
and purpose of the customer relationship in order to develop a risk profile; and conduct
ongoing monitoring to identify and report suspicious transactions and, on a risk basis,
keep customer information current.

Translated into an engineer's terms: an identity record with a verification method and its
result; a graph from a legal entity to the natural persons who own or control it; a risk
rating with the inputs that produced it; and a monitoring process that runs for the life of
the relationship, not once at onboarding.

Verification itself is often delegated to a provider that checks government-issued
documents and matches them against a selfie, or authenticates via 3D Secure at the payment
step. The engineering obligation does not disappear when it is delegated: the result, the
method, the timestamp and the reference must be stored, and the decision of what to do with
an inconclusive result is a product decision with a compliance owner.

## AML: watching and reporting

Anti-money-laundering is what happens after onboarding. Transactions are monitored against
rules and models — structuring below thresholds, velocity spikes, geography mismatches,
counterparties on a sanctions list. Alerts are reviewed, and a genuine suspicion becomes a
report to the financial intelligence unit. In the United States that is a suspicious
activity report; the pattern is similar elsewhere.

Two engineering properties define this area. Screening must be repeatable and explainable:
you will be asked why an alert fired, months later, and a model score with no feature
explanation is not an answer. And the systems are deliberately separate from the customer
path: an investigation must be able to read the ledger and the event history without a
production change, and the investigation itself must be logged.

## The risk-based approach

Regulation is written in terms of risk, so the system needs a risk model with explicit
inputs and thresholds: customer type, geography, product, channel, transaction pattern.
Low-risk customers are monitored lightly and high-risk ones heavily, and the rating is
reviewed when circumstances change.

The engineering consequence is that risk is data, not code. Thresholds change, lists change,
rules change, and every change needs a version, an effective date and an audit entry. A
hard-coded threshold in a service is a compliance finding waiting to happen.

## Audit trails

An audit trail is a record of what happened, who did it, when, on whose authority, and with
what result. For a regulated system the minimum is: every state change to a customer, an
account, a payment or a limit; the actor, human or system; the authority or reason; the
before and after values; and a timestamp from a source that cannot be quietly rewritten.

Three properties distinguish an audit trail from application logging. It is append-only —
records are not updated or deleted by the application. It is tamper-evident, so an
alteration is detectable. And it is retained for a defined period set by regulation, not by
storage cost.

The ledger's immutability and the audit trail are close relatives. Where the ledger is the
record of money, the audit trail is the record of decisions, and both must survive a
database migration, a service rewrite and a vendor change.

## Engineering consequences

Personal data under audit retention creates a real conflict with deletion requests: some
records must be kept for years while the same system is expected to honour erasure. The
resolution is data classification — separate the identity attributes that can be erased or
pseudonymised from the transaction records that must be retained — and a documented policy
rather than an ad hoc one.

Access to these stores is itself controlled and logged, with least privilege and break-glass
procedures, because the audit trail is a target: an attacker who can edit it can hide their
work. Encryption at rest and in transit, key management, and data residency rules all
follow from the same source.

Finally, the systems must be testable in a way that does not use real customer data, which
means synthetic identities and a sandbox that behaves like production.

## What a staff answer adds

Classification of every field as identity, transaction, or derived, with retention and
access rules per class. Verification and monitoring designed as versioned, auditable
workflows rather than inline checks. A named owner for the rules and thresholds, and a
change process that leaves a trail. And the honesty to say that compliance constrains the
architecture — it decides what can be deleted, where data may live, and who may read it —
so it belongs in the design conversation at the start rather than in a review at the end.
