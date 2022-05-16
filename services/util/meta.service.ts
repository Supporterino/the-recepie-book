"use strict";

import { Service, ServiceBroker} from "moleculer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { VersionResponse } from "../../types/responses/version-response";
import { version } from "../../package.json";

export default class MetaService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "meta",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				version: {
					rest: {
						method: "GET",
						path: "/version",
					},
					handler: (): VersionResponse => this.versionInfo(),
				},
			},
		});
	}
	public versionInfo(): VersionResponse {
		return {
			version: `v${version}`,
		} as VersionResponse;
	}
}
