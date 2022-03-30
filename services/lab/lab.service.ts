"use strict";

import { Service, ServiceBroker} from "moleculer";
const Laboratory =  require("@moleculer/lab"); // eslint-disable-line @typescript-eslint/no-var-requires

export default class RecipeDeletionService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "laboratory",
            version: 1,
			mixins: [Laboratory.AgentService],
			settings: {
				name: "lab",
				token: "dqwefgewrgerg",
				apiKey: "JKFNV1S-474445S-NYRKGSY-BXFWCYF",
			},
		});
	}
}
