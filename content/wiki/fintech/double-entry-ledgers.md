---
slug: double-entry-ledgers
title: Double-entry ledgers and why balances are derived
lang: en
domain: fintech
topic: accounting
tech:
  name: Payment ledger
  version_range: ">=2024"
levels: [senior, staff]
summary: >-
  A ledger is an append-only journal of balanced entries, and a balance is a query over
  it. The moment a balance is a mutable column that code increments, the system has two
  truths and no way to prove which one is right after a partial failure.
prerequisites: []
related: [idempotency-and-once-only-effects, reconciliation-and-drift, payment-lifecycle]
sources:
  - title: "Accounting for Computer Scientists"
    url: https://martin.kleppmann.com/2011/03/07/accounting-for-computer-scientists.html
    kind: article
  - title: "Stripe — Receive payouts"
    url: https://docs.stripe.com/payouts
    kind: official-docs
review_status: draft
---

## Why a balance is a query

The naive design stores a balance and updates it on every event. It works until the first
partial failure, and then it is unrecoverable, because the update and the event that
justified it are two writes that can disagree. There is no way to tell whether the balance
is right, no audit trail of how it got there, and no way to reconstruct it.

A double-entry ledger inverts this. The journal is the truth: an append-only sequence of
entries, each of which moves money between accounts and must balance. A balance is then a
derived value — a sum over an account's postings, possibly materialised as a cache. If the
cache is wrong, it is rebuilt. If the journal is wrong, the entry is reversed with another
entry. Nothing is ever edited.

This is the single most useful sentence to open with in a fintech interview: the balance is
a query, and the journal is the source of truth.

## The model: accounts, entries, postings

Accounts are the buckets: a customer wallet, a merchant receivable, a fee revenue account,
a settlement suspense account, an FX position. Accounts belong to a chart of accounts, and
their type determines which side increases them.

An entry, often called a journal entry or transaction, is a dated event with a description
and a reference to what caused it. It contains two or more postings, each a signed amount
against one account. The rule is that the postings of an entry sum to zero: the money that
left one account arrived in another. Debits and credits are the same arithmetic with
different signs, and arguing about which is which misses the point — the invariant is the
sum.

Every posting carries the currency it is denominated in, and the entry carries the
reference to the business event: the payment, the refund, the payout, the fee.

## Invariants

Four invariants make a ledger defensible, and an interviewer expects them stated.

Balance: the postings of every entry sum to zero in each currency.

Immutability: entries are never updated or deleted. A correction is a new entry that
reverses the old one, with a reason, and the original stays visible. This is what makes the
history auditable, and auditors will ask.

Append-only sequence: entries are ordered, and the ordering is stable. Reconstructing a
balance at a point in time is then a sum up to a sequence number.

Traceability: every posting traces to a business event and a source document. A ledger
that cannot answer where a number came from is a spreadsheet with extra steps.

Enforce these in the storage layer, not in application code: a constraint that rejects an
unbalanced entry is worth more than a code review.

## Money and currency

Store amounts as integers in the currency's minor unit, with the currency code attached to
every amount. Floats are not acceptable for money, and an interviewer will treat their
presence as disqualifying. Know the currency's exponent — most currencies have two decimal
places, some have none, some have three — and never assume two.

Multi-currency systems need an explicit decision about the rate. The defensible pattern is
to record both the original amount and the converted amount with the rate and its source
on the entry, so a later dispute can be recomputed rather than guessed. Do not store a
single converted number and throw away the evidence.

## Derived balances and snapshots

Summing all postings on every read is correct and, past a certain volume, too slow. The
standard answer is a snapshot: store the balance as of a sequence number and sum only the
postings after it. A snapshot is a cache with a known provenance, so it can always be
discarded and rebuilt — which is the property that makes it safe.

Rebuilding is also the recovery story. If a suspicion arises about a materialised balance,
the operation is a recomputation from the journal and a diff, not a patch. Two independent
recomputations that agree is the strongest statement a financial system can make.

## Corrections, not edits

Every real ledger accumulates mistakes: a duplicate charge, a fee booked to the wrong
account, an FX rate keyed incorrectly. Each is corrected by a compensating entry that
names the error, and the correction is itself auditable. This is not accounting pedantry;
it is the mechanism that lets a support agent explain a customer's statement months later.

The anti-pattern is a migration or a manual statement that rewrites history. Once a row can
change, the balance can change without an entry, and reconciliation against an external
statement stops meaning anything.

## What a staff answer adds

The ledger as the system of record for every money movement, with everything else derived:
balances, statements, reporting, even risk limits computed from it. Idempotency at the
entry level, so a retried operation does not double-post. Reconciliation as a scheduled
job that compares the journal to external statements and alerts on any break, because the
ledger being internally consistent does not mean it agrees with the bank. And retention and
access controls that treat the journal as the regulated record it is, rather than as an
application table.
