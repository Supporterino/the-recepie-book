"use strict";

import {Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { Tag } from "../../types/tag";

export default class TagsService extends Service {
    private DBConnection = new Connection("tags").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "tags",
            version: 1,
            mixins: [this.DBConnection],
			settings: {
				fields: [
					"_id",
					"name",
				],
				entityValidator: {
					name: "string",
				},
			},
			actions: {
				/**
				 * Returns a list of possible tags containing the provided string
				 *
				 * @method
				 * @param {String} name - The string to search inside the tags table
				 * @returns {Array<string>} - A list of the matching tags as JSON string
				 */
				getByString: {
					rest: {
						path: "/getByString",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					async handler(ctx): Promise<string> {
						return await this.getTagByName(ctx.params.name);
					},
				},
				/**
				 * Check if a tag exists in the table and return its id if not present creates the tag
				 *
				 * @method
				 * @param {String} name - the name of the tag to check
				 * @returns {String} - The id of the tag
				 */
				checkForTag: {
					rest: {
						path: "/checkForTag",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					async handler(ctx): Promise<string> {
						return await this.checkTagAndGetID(ctx.params.name);
					},
				},
			},
		}, schema));
	}

	public async checkTagAndGetID(tagName: string) {
		this.logger.info(`Checking if ${tagName} exists in the DB.`)
		const tags = await this.broker.call("v1.tags.find", { query: { name: tagName } }) as Tag[];
		if (tags.length === 1) {
			const tag = tags[0];
			return tag._id;
		} else if (tags.length === 0) {
			this.logger.info(`Creating tag: ${tagName}`)
			const tag = await this.broker.call("v1.tags.create", { name: tagName }) as Tag;
			return tag._id;
		} else {
			throw new Error(`Someone fucked the tags database and got '${tagName}' more than once in there.`);
		}
	}

	public async getTagByName(name: string) {
		try {
			const tags = await this.broker.call("v1.tags.find", { query: { name: { $regex: name } } }) as Tag[];
			if (tags.length > 0) {return tags;}
			else {return `No tags found containing: ${name}`;}
		} catch (error) {
			return `Error during fetching: Error: ${error}.`;
		}
	}
}
