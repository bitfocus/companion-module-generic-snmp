import type { Generic_SNMP } from './index.js'
import { DisplayStringOption, UpdateOption } from './actions.js'
import { prepareVarbindForVariableAssignment, isValidSnmpOid } from './oidUtils.js'
import type { CompanionFeedbackDefinition, CompanionInputFieldNumber } from '@companion-module/base'
// import snmp from 'net-snmp'

export const DivisorOption = {
	type: 'number',
	id: 'div',
	label: 'Scaling Divisor',
	default: 1,
	min: 1,
	max: Number.MAX_SAFE_INTEGER,
	step: 1,
	description:
		'If OID returns a number, value will be divided by this value. Ie use `100` to achieve 2 decimal precision. Does not work with Counter64 type VarBinds.',
} as const satisfies CompanionInputFieldNumber

export enum FeedbackId {
	GetOID = 'getOID',
}

export default function (self: Generic_SNMP): void {
	const feedbackDefs = {} as Record<FeedbackId, CompanionFeedbackDefinition>
	feedbackDefs[FeedbackId.GetOID] = {
		name: 'OID value',
		type: 'value',
		options: [
			{
				type: 'dropdown',
				id: 'oid',
				label: 'OID',
				choices: self.getOidChoices(),
				default: self.getOidChoices()[0]?.id ?? '',
				regex: '/^\\d+(?:\\.\\d+)*$/',
			},
			DivisorOption,
			DisplayStringOption,
			UpdateOption,
		],
		callback: async (feedback, _context) => {
			const oid = feedback.options.oid?.toString() ?? ''
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to Feedback: ${feedback.id}`)
			self.oidTracker.updateFeedback(feedback.id, oid)
			if (!self.oidValues.has(oid)) {
				self.log('info', `Feedback OID not cached yet for ${feedback.id}, retrieving: ${oid}`)
				await self.getOid(oid)
			}
			const varbind = self.oidValues.get(oid)
			if (varbind == undefined || varbind.value === undefined)
				throw new Error(`Varbind not found or has no value, can't update local variable feedback ${feedback.id}`)
			return prepareVarbindForVariableAssignment(
				varbind,
				Boolean(feedback.options.displaystring),
				Number(feedback.options.div),
			)
		},
		subscribe: async (feedback, _context) => {
			if (feedback.options.update) {
				const oid = feedback.options.oid?.toString() ?? ''
				if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to Feedback: ${feedback.id}`)
				self.oidTracker.addFeedback(feedback.id, oid)
				self.pendingOids.add(oid)
				self.throttledBatchGet()
			}
		},
		learn: async (feedback, _context) => {
			const oid = feedback.options.oid?.toString() ?? ''
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to Feedback: ${feedback.id}`)
			self.oidTracker.updateFeedback(feedback.id, oid)
			await self.getOid(oid)
			return undefined
		},
		unsubscribe: (feedback) => {
			self.oidTracker.removeFeedback(feedback.id)
		},
	}
	self.setFeedbackDefinitions(feedbackDefs)
}
