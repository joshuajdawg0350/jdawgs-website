# Q-Day Ledger™ — Post-Quantum Migration Plan

© 2026 Joshua Dawson / J-Dawgs Industries

Assets: 37 · Planning-estimate effort: 231 engineer-days · Nearest governing deadline: 2030-12-31

## Phase 1 — Fix first — broken & harvest-now-critical
*Start now; complete within 12 months.* Classically broken primitives and HIGH harvest-now-decrypt-later exposure are already late — no mandate date required.

| # | Asset | Algorithm | Location | Risk | HNDL | Replacement | Governing mandate | Deadline | Est. days |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Signature container firmware/firmware-v3.p7s | RSA | firmware/firmware-v3.p7s | 100 (CRITICAL) | HIGH | ML-KEM-768 / ML-DSA-65 (FIPS 203/204) | CNSA2-SIGNING | 2030-12-31 | 15 |
| 2 | Certificate legacy.example.internal | RSA | certs/server-rsa.pem | 91 (CRITICAL) | HIGH | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 3 |
| 3 | Certificate ec.example.internal | ECDSA | certs/server-ec.pem | 86 (CRITICAL) | HIGH | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 3 |
| 4 | Certificate Sample Root CA | RSA | certs/root-ca.der | 86 (CRITICAL) | HIGH | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 3 |
| 5 | RSA in src/Service.java | RSA | src/Service.java:12 | 85 (CRITICAL) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 6 | RSA in src/web.js | RSA | src/web.js:9 | 80 (CRITICAL) | LOW | ML-KEM-768 (FIPS 203) | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 7 | DES in src/Service.java | DES | src/Service.java:16 | 75 (CRITICAL) | LOW | AES-256-GCM | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 8 | SBOM crypto asset RSA | RSA | sbom/bom.cdx.json | 75 (CRITICAL) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 9 | RSA in src/app.py | RSA | src/app.py:18 | 75 (CRITICAL) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 10 | RSA in src/main.go | RSA | src/main.go:14 | 75 (CRITICAL) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 11 | DES in src/app.py | DES | src/app.py:20 | 65 (HIGH) | LOW | AES-256-GCM | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 12 | MD5 in src/Service.java | MD5 | src/Service.java:7 | 55 (HIGH) | LOW | SHA-384 or SHA-512 (FIPS 180-4); SHA-3 where required | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 13 | MD5 in src/app.py | MD5 | src/app.py:10 | 55 (HIGH) | LOW | SHA-384 or SHA-512 (FIPS 180-4); SHA-3 where required | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 14 | MD5 in src/main.go | MD5 | src/main.go:7 | 55 (HIGH) | LOW | SHA-384 or SHA-512 (FIPS 180-4); SHA-3 where required | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 15 | SHA-1 in src/app.py | SHA-1 | src/app.py:13 | 55 (HIGH) | LOW | SHA-384 or SHA-512 (FIPS 180-4) | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 16 | SHA-1 in src/web.js | SHA-1 | src/web.js:5 | 55 (HIGH) | LOW | SHA-384 or SHA-512 (FIPS 180-4) | IR8547-DEPRECATE | 2030-12-31 | 5 |

## Phase 2 — The 2030 wall
*Complete by 2030-12-31.* CNSA 2.0 exclusive-use (signing, networking) · EO 14412 key establishment · NIST IR 8547 deprecation of classical public-key crypto at every approved strength.

| # | Asset | Algorithm | Location | Risk | HNDL | Replacement | Governing mandate | Deadline | Est. days |
|---|---|---|---|---|---|---|---|---|---|
| 1 | RSA in src/Service.java | RSA | src/Service.java:11 | 72 (HIGH) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 2 | RSA in src/app.py | RSA | src/app.py:5 | 72 (HIGH) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 3 | RSA in src/web.js | RSA | src/web.js:6 | 72 (HIGH) | LOW | ML-DSA-65 (FIPS 204) | CNSA2-SIGNING | 2030-12-31 | 5 |
| 4 | ECDH in src/Service.java | ECDH | src/Service.java:19 | 70 (HIGH) | LOW | ML-KEM-768 (FIPS 203), hybrid X25519+ML-KEM-768 in transition | CNSA2-NETWORKING | 2030-12-31 | 5 |
| 5 | Library ecdsa@0.19.0 in requirements.txt | ECDSA | requirements.txt | 70 (HIGH) | LOW | ML-DSA-65 (FIPS 204); SLH-DSA (FIPS 205) for long-lived roots | CNSA2-SIGNING | 2030-12-31 | 8 |
| 6 | ECDSA in src/main.go | ECDSA | src/main.go:15 | 70 (HIGH) | LOW | ML-DSA-65 (FIPS 204); SLH-DSA (FIPS 205) for long-lived roots | CNSA2-SIGNING | 2030-12-31 | 5 |
| 7 | ECDSA in src/web.js | ECDSA | src/web.js:8 | 70 (HIGH) | LOW | ML-DSA-65 (FIPS 204); SLH-DSA (FIPS 205) for long-lived roots | CNSA2-SIGNING | 2030-12-31 | 5 |
| 8 | Library jsencrypt@^3.3.2 in package.json | RSA | package.json | 70 (HIGH) | LOW | ML-KEM-768 (FIPS 203) | IR8547-DEPRECATE | 2030-12-31 | 8 |
| 9 | AES-128 in src/app.py | AES-128 | src/app.py:21 | 30 (MEDIUM) | LOW | AES-256 (CNSA 2.0 symmetric baseline) | IR8547-DEPRECATE | 2030-12-31 | 5 |
| 10 | AES-128 in src/web.js | AES-128 | src/web.js:7 | 30 (MEDIUM) | LOW | AES-256 (CNSA 2.0 symmetric baseline) | IR8547-DEPRECATE | 2030-12-31 | 5 |

## Phase 3 — The 2031 signature wave
*Complete by 2031-12-31.* EO 14412 digital-signature migration; remaining HIGH-risk items.

_No items._

## Phase 4 — Completion & standardization (2033–2035)
*Complete by 2035-12-31.* CNSA 2.0 web/cloud/OS exclusive-use (2033) · IR 8547 disallowance & NSM-10 completion (2035) · AES-256 / SHA-384 standardization.

| # | Asset | Algorithm | Location | Risk | HNDL | Replacement | Governing mandate | Deadline | Est. days |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Firmware image firmware/bootloader.bin | UNKNOWN | firmware/bootloader.bin | 48 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 20 |
| 2 | Firmware image firmware/firmware-v3.bin | UNKNOWN | firmware/firmware-v3.bin | 48 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 20 |
| 3 | UNKNOWN in src/app.py | UNKNOWN | src/app.py:23 | 43 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 5 |
| 4 | Private key (PRIVATE KEY) at keys/root-ca.key | UNKNOWN | keys/root-ca.key | 35 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 4 |
| 5 | Private key (PRIVATE KEY) at keys/server-ec.key | UNKNOWN | keys/server-ec.key | 35 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 4 |
| 6 | Private key (PRIVATE KEY) at keys/server-rsa.key | UNKNOWN | keys/server-rsa.key | 35 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 4 |
| 7 | Library crypto-js@^4.2.0 in package.json | UNKNOWN | package.json | 35 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 8 |
| 8 | Library pycrypto@2.6.1 in requirements.txt | UNKNOWN | requirements.txt | 35 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 8 |
| 9 | Library openssl@1.1.1w in sbom/bom.cdx.json | UNKNOWN | sbom/bom.cdx.json | 35 (MEDIUM) | LOW | Identify the algorithm, then re-score | — | — | 8 |
| 10 | AES in src/app.py | AES | src/app.py:19 | 30 (MEDIUM) | LOW | AES-256 | — | — | 5 |
| 11 | SHA-256 in src/app.py | SHA-256 | src/app.py:16 | 15 (LOW) | LOW | SHA-384 preferred for new designs (FIPS 180-4) | — | — | 5 |

