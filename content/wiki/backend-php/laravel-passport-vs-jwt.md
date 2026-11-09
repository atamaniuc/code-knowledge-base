---
slug: laravel-passport-vs-jwt
title: Laravel Passport, JWT and token revocation
lang: en
domain: backend-php
topic: auth
tech:
  name: Laravel
  version_range: ">=11"
levels: [senior]
summary: >-
  Passport is a full OAuth2 server with revocable tokens stored in the database; a plain JWT is stateless and cannot be revoked server-side, so revocation must be designed around short lifetimes, blacklists or token versions.
prerequisites: []
related: [laravel-middleware-and-bootstrap]
sources:
  - title: "Laravel — Passport"
    url: https://laravel.com/docs/11.x/passport
    kind: official-docs
  - title: "JWT — Introduction"
    url: https://jwt.io/introduction
    kind: article
review_status: draft
---

## Passport and OAuth2

Laravel Passport is an OAuth2 server: it issues access and refresh tokens, stores them in
database tables, validates them on every request, and supports scopes and clients. Because
tokens live in the database, revoking one is immediate and real — delete or mark the token,
and the next request fails. That is why a platform with 2FA and per-company access uses
Passport.

## Plain JWT trade-offs

A plain JWT is a signed token whose payload carries claims; the server verifies the
signature and trusts the claims without a database lookup. That is fast and stateless, and
it is also the problem: the server cannot revoke a single token without keeping state.
"JWT is stateless" means "there is no server-side record to delete".

## Revocation and token storage

Real revocation designs add state back: short access-token lifetimes with refresh tokens
(the refresh token is the revocable record), a blacklist of jti claims, a
token_version column on the user that increments on logout or password change, or
refresh-token rotation with reuse detection. On the frontend, the storage choice matters:
localStorage survives refresh but is readable by any script, memory is safer but lost on
reload, and an httpOnly cookie is invisible to JavaScript but needs CSRF protection. The
answer an interviewer wants names the trade-off and the revocation mechanism, not just
"we use JWT".
