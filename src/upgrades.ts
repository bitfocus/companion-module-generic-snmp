// import snmp from 'net-snmp'
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
		_props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
	): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
		const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
			updatedActions: [],
			updatedConfig: null,
			updatedFeedbacks: [],
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
				action.options.displaystring ??= { isExpression: false, value: false }
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
				feedback.options.div ??= { isExpression: false, value: 1 }
				feedback.options.update ??= { isExpression: false, value: true }
				feedback.options.displaystring ??= { isExpression: false, value: true }
				result.updatedFeedbacks.push(feedback)
			}
		}
		return result
	},
] satisfies CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets>[]
