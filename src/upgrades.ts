/* eslint-disable @typescript-eslint/no-base-to-string */
// import snmp from 'net-snmp'
import { generateEngineId } from './oidUtils.js'
import { ModuleConfig, ModuleSecrets } from './configs.js'
import {
	type CompanionStaticUpgradeProps,
	type CompanionStaticUpgradeResult,
	type CompanionUpgradeContext,
	type CompanionStaticUpgradeScript,
	CreateUseActionResultStoreUpgradeScript,
	FixupNumericOrVariablesValueToExpressions,
	type ExpressionOrValue,
} from '@companion-module/base'
import snmp from 'net-snmp'
import { ActionId } from './actions.js'
import { FeedbackId } from './feedbacks.js'

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
		if (action.actionId === (ActionId.GetOID as string)) {
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
		if (feedback.feedbackId === (FeedbackId.GetOID as string)) {
			if ('displaystring' in feedback.options) delete feedback.options.displaystring
			feedback.options.oid = FixupOidOrExpressionValueToExpression(String(feedback.options.oid?.value))
			feedback.options.div ??= { isExpression: false, value: 1 }
			feedback.options.update ??= { isExpression: false, value: true }
			feedback.options.encoding ??= { isExpression: false, value: 'utf8' }
			result.updatedFeedbacks.push(feedback)
		}
	}
	for (const action of props.actions) {
		if (action.actionId === (ActionId.SetString as string)) {
			if ('displaystring' in action.options) delete action.options.displaystring
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid?.value))
			action.options.encoding ??= { isExpression: false, value: 'utf8' }
			action.options.value = {
				isExpression: action.options.value?.isExpression ?? false,
				value: String(action.options.value?.value),
			}
			result.updatedActions.push(action)
		} else if (action.actionId === (ActionId.SetNumber as string)) {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid?.value))
			action.options.type = {
				isExpression: false,
				value: action.options.type?.value ?? snmp.ObjectType.Integer,
			}
			action.options.value = FixupNumericOrVariablesValueToExpressions({
				isExpression: action.options.value?.isExpression ?? false,
				value: String(action.options.value?.value),
			})
			result.updatedActions.push(action)
		} else if (action.actionId === (ActionId.SetBoolean as string)) {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid?.value))
			action.options.value = FixupBooleanStringOrVariablesValueToExpression(String(action.options.value?.value))
			result.updatedActions.push(action)
		} else if (action.actionId === (ActionId.SetIpAddress as string)) {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid?.value))
			action.options.value = {
				isExpression: action.options.value?.isExpression ?? false,
				value: String(action.options.value?.value),
			}
			result.updatedActions.push(action)
		} else if (action.actionId === (ActionId.SetOID as string)) {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid?.value))
			action.options.value = {
				isExpression: action.options.value?.isExpression ?? false,
				value: String(action.options.value?.value),
			}
			result.updatedActions.push(action)
		} else if (action.actionId === (ActionId.GetOID as string)) {
			action.options.oid = FixupOidOrExpressionValueToExpression(String(action.options.oid?.value))
			action.options.encoding ??= { isExpression: false, value: 'utf8' }
			action.options.div ??= { isExpression: false, value: 1 }
			action.options.update = { isExpression: false, value: action.options.update?.value as unknown as boolean }
			result.updatedActions.push(action)
		}
	}
	return result
}

function v310(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
	const upgrade = CreateUseActionResultStoreUpgradeScript<ModuleConfig>({
		[ActionId.GetOID]: 'variable',
	})(_context, props as unknown as CompanionStaticUpgradeProps<ModuleConfig, undefined>)

	return upgrade as unknown as CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets>
}

function v311(
	_context: CompanionUpgradeContext<ModuleConfig>,
	props: CompanionStaticUpgradeProps<ModuleConfig, ModuleSecrets>,
): CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> {
	const result: CompanionStaticUpgradeResult<ModuleConfig, ModuleSecrets> = {
		updatedActions: [],
		updatedConfig: null,
		updatedSecrets: null,
		updatedFeedbacks: [],
	}

	for (const action of props.actions) {
		if (action.actionId === (ActionId.GetOID as string)) {
			if ('update' in action.options) {
				delete action.options.update
				result.updatedActions.push(action)
			}
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
	v310,
	v311,
]
