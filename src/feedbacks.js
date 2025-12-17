import { OidOption, DisplayStringOption } from './actions.js'

export default async function (self) {
	const feedbackDefs = {}
	feedbackDefs['getOID'] = {
		name: 'OID value',
		type: 'value',
		options: [OidOption, DisplayStringOption],
		callback: async (feedback, _context) => {
			if (!self.oidValues.has(feedback.options.oid)) {
				self.log('info', `Feedback OID not cached yet for ${feedback.id}, retrieving: ${feedback.options.oid}`)
				await self.getOid(feedback.options.oid, '', feedback.options.displaystring, null, feedback.id)
			}
			return self.oidValues.get(feedback.options.oid) ?? null
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
