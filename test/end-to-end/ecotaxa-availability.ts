import { execSync } from 'child_process'
import fs from 'fs'

// The UVP import e2e suites need BOTH the on-disk import dataset and a healthy EcoTaxa dev
// instance. When either is missing (e.g. GitHub CI has no dataset, or EcoTaxa dev is down) the
// suite should be SKIPPED rather than reported as failed. Because Jest selects describe vs
// describe.skip synchronously at load time, the EcoTaxa probe is done synchronously here via
// curl (-k so a dev TLS cert can't be mistaken for an outage; -m for a short timeout).
//
// A reachable reverse proxy in front of a dead backend answers with a 5xx gateway error
// (502/503/504) — so "got an HTTP response" is NOT enough: we require a status code < 500.
export function ecotaxaE2eAvailable(datasetDir: string, ecotaxaUrl: string): { available: boolean; reason?: string } {
    if (!fs.existsSync(datasetDir)) {
        return { available: false, reason: `import dataset not found at ${datasetDir}` }
    }
    let httpCode: string
    try {
        httpCode = execSync(
            `curl -sk -o /dev/null -m 6 -w "%{http_code}" ${JSON.stringify(ecotaxaUrl)}`,
            { stdio: ['ignore', 'pipe', 'ignore'], timeout: 8000 }
        ).toString().trim()
    } catch {
        // Connection refused / timeout / DNS failure → curl exits non-zero.
        return { available: false, reason: `EcoTaxa instance unreachable (connection failed) at ${ecotaxaUrl}` }
    }
    const code = parseInt(httpCode, 10)
    if (!code || code >= 500) {
        return { available: false, reason: `EcoTaxa instance not healthy (HTTP ${httpCode || "no response"}) at ${ecotaxaUrl}` }
    }
    return { available: true }
}
