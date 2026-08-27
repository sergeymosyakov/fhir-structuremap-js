# Security Policy

## Reporting a Vulnerability

Please **do not** report security vulnerabilities through public GitHub issues.

Instead, email [sergeymosyakov@gmail.com](mailto:sergeymosyakov@gmail.com) with:

- A description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 48 hours. If the issue is confirmed, a fix will be released as soon as possible.

## Scope

`fhir-structuremap-js` is a pure computation library — it makes no network calls, stores no data, and has no server or backend component. It executes FHIR StructureMap (FML) documents against data you provide, using a FHIRPath evaluator and resolvers you inject (see the README's Mapping Support API) — it never bundles or fetches its own.

Published to npm via [Trusted Publishing (OIDC)](https://docs.npmjs.com/trusted-publishers) with build provenance — no long-lived `NPM_TOKEN` secret is used for releases.
