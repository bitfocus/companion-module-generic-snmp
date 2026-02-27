import type Generic_SNMP from './index.js'
import { DisplayStringOption, UpdateOption, DivisorOption, OidDropdownOptions, EncodingOption } from './options.js'
import { prepareVarbindForVariableAssignment, isValidSnmpOid, trimOid } from './oidUtils.js'
import type { CompanionFeedbackDefinitions } from '@companion-module/base'
// import snmp from 'net-snmp'

export enum FeedbackId {
	GetOID = 'getOID',
}

export type FeedbackSchema = {
	[FeedbackId.GetOID]: {
		type: 'value'
		options: {
			oid: string
			div: number
			displaystring: boolean
			update: boolean
			encoding: BufferEncoding
		}
	}
}

export default function (self: Generic_SNMP): CompanionFeedbackDefinitions<FeedbackSchema> {
	const feedbackDefs = {} as CompanionFeedbackDefinitions<FeedbackSchema>
	feedbackDefs[FeedbackId.GetOID] = {
		name: 'OID value',
		type: 'value',
		options: [
			{
				...OidDropdownOptions,
				choices: self.getOidChoices(),
				default: self.getOidChoices()[0]?.id ?? '',
			},
			DivisorOption,
			DisplayStringOption,
			{ ...EncodingOption, description: `Encoding method used for Opaque / Buffer values` },
			{ ...UpdateOption, default: true },
		],
		callback: async (feedback, _context) => {
			const oid = trimOid(feedback.options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to Feedback: ${feedback.id}`)
			self.oidTracker.updateFeedback(feedback.id, oid, feedback.options.update)
			if (!self.oidValues.has(oid)) {
				self.log('info', `Feedback OID not cached yet for ${feedback.id}, retrieving: ${oid}`)
				await self.getOid(oid)
			}
			const varbind = self.oidValues.get(oid)
			if (varbind == undefined || varbind.value === undefined)
				throw new Error(`Varbind not found or has no value, can't update local variable feedback ${feedback.id}`)
			return prepareVarbindForVariableAssignment(
				varbind,
				feedback.options.displaystring,
				feedback.options.div,
				feedback.options.encoding,
			)
		},
		learn: async (feedback, _context) => {
			const oid = trimOid(feedback.options.oid)
			if (!isValidSnmpOid(oid)) throw new Error(`Invalid OID supplied to Feedback: ${feedback.id}`)
			self.oidTracker.updateFeedback(feedback.id, oid, feedback.options.update)
			await self.getOid(oid)
			return undefined
		},
		unsubscribe: (feedback) => {
			self.oidTracker.removeFeedback(feedback.id)
			self.oidTracker.removeFromPollGroup(trimOid(feedback.options.oid), feedback.id)
		},
	}
	return feedbackDefs
}
