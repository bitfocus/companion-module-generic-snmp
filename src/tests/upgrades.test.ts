import { describe, it, expect } from 'vitest'
import { UpgradeScripts } from '../upgrades.js'

// ---------------------------------------------------------------------------
// v320 — adds the Connection Variables config option
// ---------------------------------------------------------------------------

/**
 * v320 is the most recently appended script. Taking it by position rather than by
 * name keeps the test honest about the order Companion actually runs them in.
 */
const v320 = UpgradeScripts[UpgradeScripts.length - 1]

const runV320 = (config: Record<string, unknown> | null) =>
	v320({} as any, { config, actions: [], feedbacks: [] } as any)

describe('v320', () => {
	it('adds variables: false to a config that predates the option', () => {
		const result = runV320({ ip: '192.168.1.1', interval: 10, verbose: false })
		expect(result.updatedConfig).toStrictEqual({
			ip: '192.168.1.1',
			interval: 10,
			verbose: false,
			variables: false,
		})
	})

	it('leaves a config that already has the option untouched', () => {
		const result = runV320({ ip: '192.168.1.1', interval: 10, verbose: false, variables: true })
		expect(result.updatedConfig).toBeNull()
	})

	// An existing connection must not silently start polling its whole cache
	it('defaults to off so existing connections keep their polling behaviour', () => {
		const result = runV320({ ip: '192.168.1.1', interval: 10, verbose: false })
		expect((result.updatedConfig as any).variables).toBe(false)
	})

	it('does nothing when there is no config to upgrade', () => {
		const result = runV320(null)
		expect(result.updatedConfig).toBeNull()
	})

	it('touches no actions or feedbacks', () => {
		const result = runV320({ ip: '192.168.1.1', interval: 10, verbose: false })
		expect(result.updatedActions).toStrictEqual([])
		expect(result.updatedFeedbacks).toStrictEqual([])
	})
})
