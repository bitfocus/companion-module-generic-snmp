/* eslint-disable @typescript-eslint/no-base-to-string */
// import snmp from 'net-snmp'
import { generateEngineId } from './oidUtils.js'
import { ModuleConfig, ModuleSecrets } from './configs.js'
import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
	FixupNumericOrVariablesValueToExpressions,
	type ExpressionOrValue,
	// type JsonValue,
	type JsonPrimitive,
} from '@companion-module/base'
import snmp from 'net-snmp'

function FixupOidOrExpressionValueToExpression(oid: string): ExpressionOrValue<string> {
	const isOid = /^(\d+\.)+\d+$/.test(oid)
	if (isOid) {
		return { isExpression: false, value: oid }
	} else {
		return { isExpression: true, value: oid }
	}
}

function FixupBooleanStringOrVariablesValueToExpression(value: string): ExpressionOrValue<boolean> {
	switch (value.toLocaleLowerCase().trim()) {
		case 'true':
		case 'on':
		case 'yes':
		case '1':
			return { isExpression: false, value: true }
		case 'false':
		case 'off':
		case 'no':
		case '0':
			return { isExpression: false, value: false }
		default:
			return { isExpression: true, value: value }
	}
}

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
}

function v210(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
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
}

function v220(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
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
}

function v230(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
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
}

function v300(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
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
			feedback.options.oid = FixupOidOrExpressionValueToExpression(String(feedback.options.oid))
			feedback.options.div ??= { isExpression: false, value: 1 }
			feedback.options.update ??= { isExpression: false, value: true }
			feedback.options.displaystring ??= { isExpression: false, value: true }
			feedback.options.encoding ??= { isExpression: false, value: 'utf8' }
			result.updatedFeedbacks.push(feedback)
		}
	}
	for (const action of props.actions) {
		if (action.actionId === 'setString') {
			if ('displaystring' in action.options) delete action.options.displaystring
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid))
			action.options.encoding ??= { isExpression: false, value: 'utf8' }
			action.options.value = { isExpression: false, value: String(action.options.value) }
			result.updatedActions.push(action)
		} else if (action.actionId === 'setNumber') {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid))
			action.options.type = {
				isExpression: false,
				value: (action.options.type as unknown as JsonPrimitive) ?? snmp.ObjectType.Integer,
			}
			action.options.value = FixupNumericOrVariablesValueToExpressions({
				isExpression: false,
				value: String(action.options.value),
			})
			result.updatedActions.push(action)
		} else if (action.actionId === 'setBoolean') {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid))
			action.options.value = FixupBooleanStringOrVariablesValueToExpression(String(action.options.value))
			result.updatedActions.push(action)
		} else if (action.actionId === 'setIpAddress') {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid))
			action.options.value = { isExpression: false, value: String(action.options.value) }
			result.updatedActions.push(action)
		} else if (action.actionId === 'setOid') {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid))
			action.options.value = { isExpression: false, value: String(action.options.value) }
			result.updatedActions.push(action)
		} else if (action.actionId === 'getOID') {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid))
			action.options.encoding ??= { isExpression: false, value: 'utf8' }
			action.options.div ??= { isExpression: false, value: 1 }
			action.options.update = { isExpression: false, value: action.options.update as unknown as boolean }
			result.updatedActions.push(action)
		}
	}
	return result
}

export const UpgradeScripts: CompanionStaticUpgradeScript<ModuleConfig, ModuleSecrets>[] = [
	pre200,
	v210,
	v220,
	v230,
	v300,
]
