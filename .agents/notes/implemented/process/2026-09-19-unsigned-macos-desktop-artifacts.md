# Agent Note: Build unsigned macOS Desktop artifacts for local use

Status: implemented

English | [中文](2026-09-19-unsigned-macos-desktop-artifacts.zh.md)

## Problem

The release path requires a Developer ID identity and one notarization strategy for every macOS package command, including directory-only and preparation-only runs. A developer without Apple credentials could therefore not produce a runnable macOS application, while Windows already offered an explicit `--unsigned` mode for local installation testing.

## Decision

`--unsigned` accepts the macOS targets as well as `win-x64` and selects a local artifact path: `prepare:dsh` keeps the vendor signatures on the packaged Mach-O files, electron-builder builds with `identity: null`, `forceCodeSigning: false`, `notarize: false`, and unsigned DMG artifacts, the temporary signing keychain is never created, and the builder environment drops `CSC_*`, `APPLE_*`, and `DSH_DESKTOP_MACOS_*` values so no configured or discoverable identity can sign the result. Output lands beside the release artifacts in `unsigned-artifacts/`, carries no update configuration, and writes no release completion record.

Explicitly passing `--unsigned` is the only way to reach that path. [macOS release packaging](../architecture/2026-08-25-electron-desktop-packaging-and-updates.md) still requires the identity, one complete notarization strategy, and their verification before any release artifact or completion record exists, so a misconfigured release run fails instead of emitting an unsigned build. An unsigned application runs on the build host; Gatekeeper rejects it elsewhere.

## Alternatives considered

**Treat `--dir` as the credential-free mode.** Directory-only commands are release qualification for the notarized application, and runtime preparation signs Mach-O files before the builder starts. Removing credentials there would change what release operators verify, so the local artifact needs its own explicit request.

**Ad-hoc sign the application instead.** An ad-hoc signature carries no Developer ID identity and no notarization ticket. It would add a second signing branch with different verification rules while still producing an artifact that Gatekeeper rejects elsewhere.

**Allow unsigned builds without `.env.macos`.** The application ID and mandatory-update origin are embedded in every artifact, including unsigned ones. Keeping one validated configuration source avoids a second, weaker configuration path.

## Consequences

A developer on a macOS build host can produce a runnable application without Apple credentials, and both desktop platforms share one `--unsigned` vocabulary. The costs are another platform-conditional branch in the packaging scripts and an artifact that must not leave the build host: upload reads the release completion record from `artifacts/`, which unsigned builds never write.
