// Resolves the WIP API key into process.env.WIP_API_KEY before any other
// server module reads it. Import this right after 'dotenv/config'.
//
// Under wip-deploy the deployer injects WIP_API_KEY (the app's own key) and
// this is a no-op. Outside the deployer, .env names the live secrets file
// (WIP_API_KEY_FILE) instead of a baked plaintext key, so a key rotation or
// redeploy is picked up on restart. A plaintext WIP_API_KEY still wins.
import { readFileSync } from 'node:fs'

const file = process.env.WIP_API_KEY_FILE
if (!process.env.WIP_API_KEY && file) {
  try {
    process.env.WIP_API_KEY = readFileSync(file, 'utf8').trim()
  } catch (err) {
    throw new Error(`WIP_API_KEY_FILE=${file} could not be read: ${(err as Error).message}`)
  }
}
