---
slug: stripe-nue-billing-in-laravel
title: Stripe and Nue in a Laravel billing flow
lang: en
domain: backend-php
topic: billing
tech:
  name: Laravel
  version_range: ">=11"
levels: [senior]
summary: >-
  Stripe remains the payment processor while Nue becomes the quote-to-revenue layer: subscriptions, billing and revenue analytics move, payments stay, and money is modelled in integer cents.
prerequisites: []
related: [laravel-queues-and-workers, laravel-testing-strategy]
sources:
  - title: "Stripe — API reference"
    url: https://docs.stripe.com/api
    kind: official-docs
  - title: "Nue — How Nue works"
    url: https://nue.io/how-nue-works
    kind: article
review_status: draft
---

## Stripe as the payment processor

Stripe has two roles that are easy to confuse. Stripe Payments is the processor: it moves
money, stores card data, handles 3DS and refunds. Stripe Billing is a layer on top: it
manages subscriptions, proration, invoicing and revenue logic, and it charges a percentage
for that layer. A Laravel app typically integrates with Stripe through Cashier or the API
directly.

## Nue as the quote-to-revenue layer

Nue is a quote-to-revenue platform built on Salesforce: CPQ (configure-price-quote),
subscriptions, billing and revenue analytics. It replaces the Stripe Billing layer while
Stripe Payments stays as the processor — the "Nue for Stripe" mode. The business motive is
cost: dropping the Stripe Billing fee and reducing revenue leakage, with one system of
record for quotes through revenue. Nue is not a payment processor; money still moves
through Stripe.

## Money as integer cents

Money is stored as integer cents (or the smallest currency unit), never as float. Float
arithmetic rounds in ways that corrupt invoices: 0.1 + 0.2 is not 0.3 in binary. Discounts
and proration are computed in cents with explicit rounding rules, and currency is stored
alongside the amount. A Laravel value object wrapping cents plus currency keeps the rule in
one place.

## Migration boundaries

The migration boundary is: quotes, subscriptions, plans and invoices move to Nue; payment
intents, chargebacks and refunds stay on Stripe. The Laravel side keeps webhook handlers
for both, an idempotent sync job, and a clear mapping between Nue subscription ids and
Stripe customer ids. The dangerous part is the overlap window: decide which system is the
source of truth for each entity before the first record migrates.
