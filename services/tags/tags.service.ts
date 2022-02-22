"use strict";

import {Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { DatabaseError } from "../../types/database-error";
import { FilterError } from "../../types/filter-error";
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
				idField: "id",
				pageSize: Number.MAX_VALUE,
				maxPageSize: Number.MAX_VALUE,
				fields: [
					"id",
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
					async handler(ctx): Promise<Tag[]|FilterError> {
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
					async handler(ctx): Promise<string | DatabaseError> {
						return await this.checkTagAndGetID(ctx.params.name);
					},
				},
			},
		}, schema));
	}

	public async checkTagAndGetID(tagName: string): Promise<string | DatabaseError> {
		this.logger.info(`Checking if ${tagName} exists in the DB.`);
		const tags = await this.broker.call("v1.tags.find", { query: { name: tagName } }) as Tag[];
		if (tags.length === 1) {
			const tag = tags[0];
			return tag.id;
		} else if (tags.length === 0) {
			this.logger.info(`Creating tag: ${tagName}`);
			const tag = await this.broker.call("v1.tags.create", { name: tagName }) as Tag;
			return tag.id;
		} else {
			return {
				name: "DatabaseError",
				message: "The database has a duplicate id which shouldn't be possible. Who fucked up?",
				database: "tags",
			} as DatabaseError;
		}
	}

	public async getTagByName(name: string): Promise<Tag[] | FilterError> {
		try {
			return await this.broker.call("v1.tags.find", { query: { name: { $regex: name, $options: "i" } } }) as Tag[];
		} catch (error) {
			return {
				name: "FilterError",
				message: `${error.message}`,
				filterType: "byName",
			} as FilterError;
		}
	}
}
