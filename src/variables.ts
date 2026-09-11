import type { CompanionVariableDefinitions, CompanionVariableValues } from '@companion-module/base'
import type Generic_SNMP from './index.js'
import { prepareVarbindForVariableAssignment } from './oidUtils.js'

/**
 * Encoding applied to Buffer backed varbinds (OctetString, Opaque) when assigning
 * them to a connection variable.
 *
 * Connection variables have no per OID options like the value actions and feedbacks
 * do, so one encoding has to serve every cached OID. UTF-8 matches the default of
 * the EncodingOption dropdown used everywhere else in the module, and is a superset
 * of the ASCII that SNMP DisplayString is specified as.
 */
export const VariableEncoding: BufferEncoding = 'utf8'

/** Connection variable values are never scaled, there is no per OID divisor to apply. */
export const VariableDivisor = 1

/**
 * Builds the connection variable definitions, one per cached OID, keyed and labelled
 * by the OID in dotted decimal form.
 *
 * Returns an empty set when the feature is switched off, so that turning the config
 * option off clears any definitions left behind by a previous session.
 */
export function GetVariableDefinitions(self: Generic_SNMP): CompanionVariableDefinitions {
	if (!self.config.variables) return {}
	const definitions: CompanionVariableDefinitions = {}
	for (const oid of self.oidValues.keys()) {
		definitions[oid] = { name: oid }
	}
	return definitions
}

/**
 * Builds the current value of every cached OID, keyed by OID in dotted decimal form.
 *
 * Returns an empty set when the feature is switched off.
 */
export function GetVariableValues(self: Generic_SNMP): CompanionVariableValues {
	if (!self.config.variables) return {}
	const values: CompanionVariableValues = {}
	for (const [oid, varbind] of self.oidValues) {
		values[oid] = prepareVarbindForVariableAssignment(varbind, VariableDivisor, VariableEncoding) ?? ''
	}
	return values
}
