#!/usr/bin/env node
import { repositoryRoot, verificationIdentity } from './identity.mjs';
try { console.log(verificationIdentity(repositoryRoot()).content); }
catch (error) { console.error('harness tree-state: ' + error.message); process.exitCode = 2; }
