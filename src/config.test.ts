import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('@companion-module/base', () => ({
	Regex: { IP: '/^[\\d.]+$/' },
}))

vi.mock('./oidUtils.js', () => ({
	generateEngineId: vi.fn(() => 'aabbccdd05112233445566'),
}))

// Helper: import a fresh copy of the module so process.execArgv changes take effect
async function loadConfig() {
	vi.resetModules()
	// Re-apply mocks after reset
	vi.mock('@companion-module/base', () => ({ Regex: { IP: '/^[\\d.]+$/' } }))
	vi.mock('./oidUtils.js', () => ({ generateEngineId: vi.fn(() => 'aabbccdd05112233445566') }))
	const mod = await import('./configs.js')
	return mod.default()
}

afterEach(() => {
	vi.restoreAllMocks()
})

// ---------------------------------------------------------------------------
// Field inventory
// ---------------------------------------------------------------------------

describe('GetConfigFields', () => {
	it('returns an array of fields', async () => {
		const fields = await loadConfig()
		expect(Array.isArray(fields)).toBe(true)
		expect(fields.length).toBeGreaterThan(0)
	})

	it('every field has an id', async () => {
		const fields = await loadConfig()
		fields.forEach((f) => expect(f).toHaveProperty('id'))
	})

	it('every field has a type', async () => {
		const fields = await loadConfig()
		fields.forEach((f) => expect(f).toHaveProperty('type'))
	})

	it('contains expected top-level field IDs', async () => {
		const fields = await loadConfig()
		const ids = fields.map((f) => f.id)
		expect(ids).toContain('ip')
		expect(ids).toContain('port')
		expect(ids).toContain('trapPort')
		expect(ids).toContain('version')
		expect(ids).toContain('community')
		expect(ids).toContain('walk')
		expect(ids).toContain('traps')
		expect(ids).toContain('portBind')
		expect(ids).toContain('interval')
		expect(ids).toContain('verbose')
	})

	it('contains expected v3 field IDs', async () => {
		const fields = await loadConfig()
		const ids = fields.map((f) => f.id)
		expect(ids).toContain('engineID')
		expect(ids).toContain('username')
		expect(ids).toContain('securityLevel')
		expect(ids).toContain('authProtocol')
		expect(ids).toContain('privProtocol')
	})
})

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

describe('default values', () => {
	it('ip defaults to 127.0.0.1', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'ip') as any
		expect(field.default).toBe('127.0.0.1')
	})

	it('port defaults to 161', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'port') as any
		expect(field.default).toBe(161)
	})

	it('trapPort defaults to 162', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'trapPort') as any
		expect(field.default).toBe(162)
	})

	it('version defaults to v1', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'version') as any
		expect(field.default).toBe('v1')
	})

	it('community defaults to "companion"', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'community') as any
		expect(field.default).toBe('companion')
	})

	it('traps defaults to false', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'traps') as any
		expect(field.default).toBe(false)
	})

	it('portBind defaults to 162', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'portBind') as any
		expect(field.default).toBe(162)
	})

	it('interval defaults to 0', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'interval') as any
		expect(field.default).toBe(0)
	})

	it('verbose defaults to false', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'verbose') as any
		expect(field.default).toBe(false)
	})

	it('securityLevel defaults to noAuthNoPriv', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'securityLevel') as any
		expect(field.default).toBe('noAuthNoPriv')
	})

	it('authProtocol defaults to md5', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'authProtocol') as any
		expect(field.default).toBe('md5')
	})

	it('privProtocol defaults to aes', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'privProtocol') as any
		expect(field.default).toBe('aes')
	})

	it('engineID default is the value returned by generateEngineId', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'engineID') as any
		expect(field.default).toBe('aabbccdd05112233445566')
	})

	it('username defaults to "companion"', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'username') as any
		expect(field.default).toBe('companion')
	})
})

// ---------------------------------------------------------------------------
// Range constraints
// ---------------------------------------------------------------------------

describe('range constraints', () => {
	it('port has min 1 and max 65535', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'port') as any
		expect(field.min).toBe(1)
		expect(field.max).toBe(65535)
	})

	it('portBind has min 162 and max 65535', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'portBind') as any
		expect(field.min).toBe(162)
		expect(field.max).toBe(65535)
	})

	it('interval has min 0 and max 3600', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'interval') as any
		expect(field.min).toBe(0)
		expect(field.max).toBe(3600)
	})
})

// ---------------------------------------------------------------------------
// Version dropdown choices
// ---------------------------------------------------------------------------

describe('version dropdown', () => {
	it('offers v1, v2c, and v3 choices', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'version') as any
		const ids = field.choices.map((c: any) => c.id)
		expect(ids).toContain('v1')
		expect(ids).toContain('v2c')
		expect(ids).toContain('v3')
		expect(ids).toHaveLength(3)
	})
})

// ---------------------------------------------------------------------------
// Auth protocol choices
// ---------------------------------------------------------------------------

describe('authProtocol dropdown', () => {
	it('offers md5 and sha choices', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'authProtocol') as any
		const ids = field.choices.map((c: any) => c.id)
		expect(ids).toContain('md5')
		expect(ids).toContain('sha')
	})
})

// ---------------------------------------------------------------------------
// Priv protocol - DES conditional on --openssl-legacy-provider
// ---------------------------------------------------------------------------

describe('privProtocol DES option', () => {
	it('does not include DES without --openssl-legacy-provider', async () => {
		const original = process.execArgv
		process.execArgv = []
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'privProtocol') as any
		const ids = field.choices.map((c: any) => c.id)
		expect(ids).not.toContain('des')
		process.execArgv = original
	})

	it('includes DES with --openssl-legacy-provider', async () => {
		const original = process.execArgv
		process.execArgv = ['--openssl-legacy-provider']
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'privProtocol') as any
		const ids = field.choices.map((c: any) => c.id)
		expect(ids).toContain('des')
		process.execArgv = original
	})

	it('always includes aes, aes256b, and aes256r regardless of flag', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'privProtocol') as any
		const ids = field.choices.map((c: any) => c.id)
		expect(ids).toContain('aes')
		expect(ids).toContain('aes256b')
		expect(ids).toContain('aes256r')
	})
})

// ---------------------------------------------------------------------------
// Visibility expressions
// ---------------------------------------------------------------------------

describe('isVisibleExpression', () => {
	it('community is only visible for v1 and v2c', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'community') as any
		expect(field.isVisibleExpression).toContain('v1')
		expect(field.isVisibleExpression).toContain('v2c')
	})

	it('v3-only fields reference version === v3', async () => {
		const fields = await loadConfig()
		const v3Fields = ['engineID', 'username', 'securityLevel', 'infov3']
		v3Fields.forEach((id) => {
			const field = fields.find((f) => f.id === id) as any
			expect(field.isVisibleExpression).toContain('v3')
		})
	})

	it('portBind is only visible when traps is enabled', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'portBind') as any
		expect(field.isVisibleExpression).toContain('traps')
	})

	it('authProtocol is only visible for authNoPriv or authPriv security levels', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'authProtocol') as any
		expect(field.isVisibleExpression).toContain('authNoPriv')
		expect(field.isVisibleExpression).toContain('authPriv')
	})

	it('privProtocol is only visible for authPriv security level', async () => {
		const fields = await loadConfig()
		const field = fields.find((f) => f.id === 'privProtocol') as any
		expect(field.isVisibleExpression).toContain('authPriv')
	})

	it('ip, port, version, traps, interval, verbose have no visibility expression', async () => {
		const fields = await loadConfig()
		const alwaysVisibleIds = ['ip', 'port', 'version', 'traps', 'interval', 'verbose']
		alwaysVisibleIds.forEach((id) => {
			const field = fields.find((f) => f.id === id) as any
			expect(field.isVisibleExpression).toBeUndefined()
		})
	})
})
