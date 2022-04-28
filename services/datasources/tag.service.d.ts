import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import { CheckForTag, GetByString } from "../../shared";
import { Tag } from "../../types";

declare class TagService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Check if a tag exists in the table and return its id if not present creates the tag
	 *
	 * @method
	 * @param {String} name - the name of the tag to check
	 * @returns {String} - The id of the tag
	 */
	public checkTagAndGetID(ctx: Context<CheckForTag>): Promise<string>;

	/**
	 * Returns a list of possible tags containing the provided string
	 *
	 * @method
	 * @param {String} name - The string to search inside the tags table
	 * @returns {Array<string>} - A list of the matching tags as JSON string
	 */
	public getTagByName(ctx: Context<GetByString>): Promise<Tag[]>;
}

export = TagService;
