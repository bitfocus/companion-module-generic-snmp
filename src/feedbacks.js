import { Regex } from '@companion-module/base'

export default async function (self) {
	const feedbackDefs = {}
	feedbackDefs['getOID'] = {
		name: 'OID value',
		type: 'value',
		options: [
			{
				type: 'textinput',
				label: 'OID',
				id: 'oid',
				default: '',
				required: true,
				useVariables: { local: true },
				regex: Regex.SOMETHING,
			},
			{
				type: 'checkbox',
				label: 'DisplayString',
				id: 'displaystring',
				tooltip: 'Convert OctetString (array of numbers) to DisplayString (text)',
				default: false,
			},
		],
		callback: async (feedback, _context) => {
			if (!self.oidValues.has(feedback.options.oid)) {
				self.getOid(feedback.options.oid, '', feedback.options.displaystring, null, feedback.id).catch(() => {})
			}
			return self.oidValues.get(feedback.id) ?? null
		},
		subscribe: async (feedback, context) => {
			await self.getOid(feedback.options.oid, '', feedback.options.displaystring, context, feedback.id)
		},
		learn: async (feedback, context) => {
			await self.getOid(feedback.options.oid, '', feedback.options.displaystring, context, feedback.id)
			return undefined
		},
	}

	self.setFeedbackDefinitions(feedbackDefs)
}
