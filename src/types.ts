import type { InstanceBase, JsonValue } from '@companion-module/base'
import type { ModuleConfig, ModuleSecrets } from './configs.js'
import type { ActionSchema } from './actions.js'
import type { FeedbackSchema } from './feedbacks.js'
import type { FeedbackOidTracker } from './oidtracker.js'
import snmp from 'net-snmp'

export interface ModuleTypes {
	config: ModuleConfig
	secrets: ModuleSecrets
	actions: ActionSchema
	feedbacks: FeedbackSchema
	variables: Record<string, JsonValue>
}

export interface InstanceBaseExt extends InstanceBase<ModuleTypes> {
	config: ModuleConfig
	oidValues: Map<string, snmp.Varbind>
	pendingOids: Set<string>
	oidTracker: FeedbackOidTracker
}
