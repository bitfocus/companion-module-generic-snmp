import snmp from 'net-snmp'
import { generateEngineId } from './oidUtils.js'
import { ModuleConfig, ModuleSecrets } from './configs.js'
import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
} from '@companion-module/base'

export default [
	/*
	 * Place your upgrade scripts here
	 * Remember that once it has been added it cannot be removed!
	 */
	function pre200(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
		}

		for (const action of props.actions) {
			if (action.actionId === 'setNumber') {
				if (action.options.type === snmp.ObjectType.Counter32) {
					action.options.type = snmp.ObjectType.Counter
				}
				if (action.options.type === snmp.ObjectType.Gauge32) {
					action.options.type = snmp.ObjectType.Gauge
				}
				if (action.options.type === snmp.ObjectType.Unsigned32) {
					action.options.type = snmp.ObjectType.Gauge
				}
			}
			result.updatedActions.push(action)
		}
		return result
	},
	function v210(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	) {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
		}
		if (props.config !== null) {
			const config = props.config
			if (config.interval == undefined || config.interval == null) {
				config.interval = 0
				result.updatedConfig = config
			}
		}

		return result
	},
	function v220(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	) {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
		}
		for (const action of props.actions) {
			if (action.actionId === 'getOID') {
				action.options.displaystring ??= false
				result.updatedActions.push(action)
			}
		}
		if (props.config !== null) {
			const config = props.config
			if (config.verbose == undefined || config.verbose == null) {
				config.verbose = false
				result.updatedConfig = config
			}
		}

		return result
	},

	function v230(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	) {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedActions: [],
			updatedConfig: null,
			updatedSecrets: null,
			updatedFeedbacks: [],
		}
		const config = props.config
		if (config) {
			if ('authKey' in config || 'privKey' in config) {
				result.updatedSecrets = {} as ModuleSecrets
				if ('authKey' in config) {
					result.updatedSecrets.authKey = String(config.authKey)

					delete config.authKey
				}
				if ('privKey' in config) {
					result.updatedSecrets.privKey = String(config.privKey)
					delete config.privKey
				}
			}
			result.updatedConfig = config
		}

		return result
	},

	function v300(
		_context: CompanionUpgradeContext<ModuleConfig>,
		props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	) {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedActions: [],
			updatedConfig: null,
			updatedSecrets: null,
			updatedFeedbacks: [],
		}
		const config = props.config
		if (config) {
			config.traps ??= false
			config.portBind ??= 162
			config.trapPort ??= 162
			config.walk ??= ''
			config.engineID = config.engineID || generateEngineId()
			result.updatedConfig = config
		}

		for (const feedback of props.feedbacks) {
			if (feedback.feedbackId === 'getOID') {
				feedback.options.div ??= 1
				result.updatedFeedbacks.push(feedback)
			}
		}
		return result
	},
] satisfies CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets>[]
