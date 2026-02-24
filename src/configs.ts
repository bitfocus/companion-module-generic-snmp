import { Regex, type SomeCompanionConfigField } from '@companion-module/base'
import { generateEngineId } from './oidUtils.js'

export type ModuleConfig = {
	ip: string
	port: number
	trapPort: number
	version: 'v1' | 'v2c' | 'v3'
	community: string
	walk: string
	engineID: string
	username: string
	securityLevel: 'noAuthNoPriv' | 'authNoPriv' | 'authPriv'
	authProtocol: 'md5' | 'sha'
	privProtocol: 'aes' | 'aes256b' | 'aes256r' | 'des'
	traps: boolean
	portBind: number
	interval: number
	verbose: boolean
}

export type ModuleSecrets = {
	authKey: string
	privKey: string
}

export default function (): SomeCompanionConfigField[] {
	const hasLegacyProviders = process.execArgv.includes('--openssl-legacy-provider')
	const privProtocols = [
		{ id: 'aes', label: '128-bit AES encryption (CFB-AES-128)' },
		{ id: 'aes256b', label: '256-bit AES encryption (CFB-AES-256) with "Blumenthal" key localiztaion' },
		{ id: 'aes256r', label: '256-bit AES encryption (CFB-AES-256) with "Reeder" key localiztaion' },
	]
	if (hasLegacyProviders) privProtocols.push({ id: 'des', label: 'DES encryption (CBC-DES)' })
	return [
		{
			type: 'textinput',
			id: 'ip',
			label: 'Agent Address',
			width: 6,
			regex: Regex.IP,
			default: '127.0.0.1',
			minLength: 7,
		},
		{
			type: 'number',
			id: 'port',
			label: 'UDP Port',
			width: 6,
			min: 1,
			max: 65535,
			default: 161,
			description: 'Connection will make Get and Set requests to this port',
		},
		{
			type: 'number',
			id: 'trapPort',
			label: 'Trap Port',
			width: 6,
			min: 1,
			max: 65535,
			default: 162,
			description: 'Connection will send traps and informs to this port',
		},
		{
			type: 'dropdown',
			id: 'version',
			label: 'SNMP Version',
			width: 6,
			choices: [
				{ id: 'v1', label: 'SNMP v1' },
				{ id: 'v2c', label: 'SNMP v2c' },
				{ id: 'v3', label: 'SNMP v3' },
			],
			default: 'v1',
		},
		{
			type: 'textinput',
			id: 'community',
			width: 6,
			label: 'Community',
			default: 'companion',
			isVisibleExpression: ` $(options:version) === 'v1' || $(options:version) === 'v2c'`,
		},
		{
			type: 'textinput',
			id: 'walk',
			width: 6,
			label: 'Walk OIDs',
			default: '',
			description: 'Comma seperated list of OIDs to walk on init.',
			regex: '/^$|^(0|1|2)(\\.(0|[1-9]\\d*))+(?:,\\s*(0|1|2)(\\.(0|[1-9]\\d*))+)*$/',
			minLength: 0,
		},
		{
			type: 'static-text',
			id: 'infov3',
			width: 12,
			label: '',
			value: '<h6>SNMP v3 Configuration</h6>',
			isVisibleExpression: ` $(options:version) === 'v3'`,
		},
		{
			type: 'textinput',
			id: 'engineID',
			width: 6,
			label: 'Engine ID',
			default: generateEngineId(63849),
			isVisibleExpression: ` $(options:version) === 'v3'`,
			regex: '/^[0-9a-fA-F]{10,64}$/',
		},
		{
			type: 'textinput',
			id: 'username',
			width: 6,
			label: 'User Name',
			default: 'companion',
			isVisibleExpression: ` $(options:version) === 'v3'`,
		},
		{
			type: 'dropdown',
			id: 'securityLevel',
			label: 'Security Level',
			width: 12,
			choices: [
				{ id: 'noAuthNoPriv', label: 'noAuthNoPriv - No message authentication or encryption' },
				{ id: 'authNoPriv', label: 'authNoPriv - Message authentication and no encryption' },
				{ id: 'authPriv', label: 'authPriv - Message authentication and encryption' },
			],
			default: 'noAuthNoPriv',
			isVisibleExpression: ` $(options:version) === 'v3'`,
		},
		{
			type: 'dropdown',
			id: 'authProtocol',
			label: 'Auth Protocol',
			width: 6,
			choices: [
				{ id: 'md5', label: 'MD5 message authentication (HMAC-MD5-96)' },
				{ id: 'sha', label: 'SHA message authentication (HMAC-SHA-96)' },
			],
			default: 'md5',
			isVisibleExpression: ` $(options:version) === 'v3' && ( $(options:securityLevel) === 'authNoPriv' || $(options:securityLevel) === 'authPriv' )`,
		},
		{
			type: 'secret-text',
			id: 'authKey',
			label: 'Auth Key',
			width: 6,
			default: '',
			isVisibleExpression: ` $(options:version) === 'v3' && ( $(options:securityLevel) === 'authNoPriv' || $(options:securityLevel) === 'authPriv' )`,
		},
		{
			type: 'dropdown',
			id: 'privProtocol',
			label: 'Priv Protocol',
			width: 6,
			choices: privProtocols,
			default: 'aes',
			isVisibleExpression: ` $(options:version) === 'v3' && $(options:securityLevel) === 'authPriv' `,
		},
		{
			type: 'secret-text',
			id: 'privKey',
			label: 'Priv Key',
			width: 6,
			default: '',
			isVisibleExpression: ` $(options:version) === 'v3' && $(options:securityLevel) === 'authPriv' `,
		},
		{
			type: 'checkbox',
			id: 'traps',
			label: 'Listen for Traps',
			default: false,
			width: 6,
		},
		{
			type: 'number',
			id: 'portBind',
			label: 'Listening Port',
			width: 6,
			min: 162,
			max: 65535,
			default: 162,
			isVisibleExpression: `$(options:traps)`,
			description: 'Connection will bind to this port to listen for SNMP Traps & Informs',
		},
		{
			type: 'number',
			id: 'interval',
			label: 'Poll Interval',
			width: 6,
			min: 0,
			max: 3600,
			default: 0,
			description: 'Seconds. Set to 0 to turn polling off.',
		},
		{
			type: 'checkbox',
			id: 'verbose',
			label: 'Verbose Logs',
			default: false,
			width: 6,
		},
	]
}
