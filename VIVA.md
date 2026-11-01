# Viva Preparation

## Why are prepared statements safer than string concatenation?

Prepared statements separate SQL code from input data. The database treats the supplied value as data rather than part of the query structure.

## Why is GET unsafe for an account update?

GET requests are intended for retrieval and can be triggered by links, images, browser prefetching, or an external page. State changes should use POST or another non-idempotent method.

## Why is a CSRF token useful?

It is an unpredictable value tied to a user session. A separate site cannot normally read it and therefore cannot create a valid state-changing request.

## Does SameSite replace CSRF tokens?

No. SameSite is a valuable additional cookie control, but token validation remains important for sensitive workflows and browser compatibility scenarios.

## Why is output encoding required for stored XSS?

Saved user content becomes dangerous when inserted into HTML without encoding. Context-appropriate encoding makes the browser display it as text instead of interpreting it as markup.

## Why should applications avoid a shell for user input?

Shell parsers interpret control characters such as semicolons and pipes. Prefer a library API or a fixed executable with a validated argument list.

## What is least privilege?

Every process, account, and database user should receive only the permissions required for its task. This limits the damage if a vulnerability is exploited.

## Why are generic error messages important?

Detailed errors can disclose database structure, valid accounts, filesystem paths, or implementation details that help attackers.
