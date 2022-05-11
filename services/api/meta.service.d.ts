import { Service, ServiceBroker } from "moleculer";
import { VersionResponse } from "../../types/responses/version-response";

declare class MetaService extends Service {
	public constructor(broker: ServiceBroker)
	/**
	 * Returns the version information for the requested backend
	 *
	 * @method
	 * @returns {VersionResponse}
	 */
	public versionInfo(): VersionResponse
}
