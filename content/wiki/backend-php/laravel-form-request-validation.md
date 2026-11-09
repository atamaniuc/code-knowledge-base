---
slug: laravel-form-request-validation
title: FormRequest validation and authorization
lang: en
domain: backend-php
topic: validation
tech:
  name: Laravel
  version_range: ">=11"
levels: [middle, senior]
summary: >-
  A FormRequest is the Laravel object that owns validation rules, messages and the authorization check for one request, keeping controllers thin and rules reusable.
prerequisites: []
related: [laravel-service-container]
sources:
  - title: "Laravel — Validation"
    url: https://laravel.com/docs/11.x/validation
    kind: official-docs
  - title: "Laravel — Form Request Validation"
    url: https://laravel.com/docs/11.x/validation#form-request-validation
    kind: official-docs
review_status: draft
---

## FormRequest

php artisan make:request StoreInvoiceRequest creates a class whose rules() method
returns the validation rules for that one request. The controller type-hints the request
class, and Laravel runs validation before the controller method executes — an invalid
request never reaches the action. This keeps controllers thin and makes the contract of
the endpoint explicit.

## Rules and messages

Rules cover existence (exists:companies,id), uniqueness, formats, arrays and custom
closures. messages() customises the wording; prepareForValidation() normalises input
before rules run — for example trimming a phone number or casting cents to integer before
the money rules see it. Custom rule objects or closures carry the logic that does not fit
a built-in rule.

## Authorization

The same class owns authorize(): it returns true when the current user may perform the
action, false otherwise. This is where tenant checks and permission checks belong, before
any validation runs — a request the user may not make should not leak which fields would
have been valid. When authorisation is already enforced in middleware, authorize() can
simply return true.
