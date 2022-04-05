"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, CheckForTagParams, DatabaseError, GetByStringParams, MAX_PAGE_SIZE, PAGE_SIZE } from "../../shared";
import { Tag } from "../../types";

export default class TagsService extends Service {
    private DBConnection = new Connection("tags").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "tags",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
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
					async handler(ctx: Context<GetByStringParams>): Promise<Tag[]> {
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
					async handler(ctx: Context<CheckForTagParams>): Promise<string> {
						return await this.checkTagAndGetID(ctx.params.name);
					},
				},
			},
		}, schema));
	}

	public async checkTagAndGetID(tagName: string): Promise<string> {
		this.logger.info(`Checking if ${tagName} exists in the DB.`);
		try {
			const tags = await this.broker.call("v1.tags.find", { query: { name: tagName } }) as Tag[];
			if (tags.length === 1) {
				const tag = tags[0];
				return tag.id;
			} else if (tags.length === 0) {
				this.logger.info(`Creating tag: ${tagName}`);
				const tag = await this.broker.call("v1.tags.create", { name: tagName }) as Tag;
				return tag.id;
			} else {
				throw new BaseError("Duplicate ID for tag. HOW ?!? o_O", 500);
			}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to check id for tag.", error.code || 500, this.name);
		}
	}

	public async getTagByName(name: string): Promise<Tag[]> {
		try {
			return await this.broker.call("v1.tags.find", { query: { name: { $regex: name, $options: "i" } } }) as Tag[];
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to get possible tags by name.", error.code || 500, this.name);
		}
	}
}
