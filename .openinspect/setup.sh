#!/bin/bash
set -e

# Open-Inspect sandbox setup for threaded
# Runs on fresh sandbox boot and during image builds.

corepack enable
pnpm install --frozen-lockfile
