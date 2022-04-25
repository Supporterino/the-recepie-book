"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, CheckForTagParams, DatabaseError, GetByStringParams, MAX_PAGE_SIZE, PAGE_SIZE } from "../../shared";
import { Tag } from "../../types";

export default class TagService extends Service {
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
				getByString: {
					rest: {
						path: "/getByString",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					handler: async (ctx: Context<GetByStringParams>): Promise<Tag[]> => await this.getByString(ctx),
				},
				checkForTag: {
					rest: {
						path: "/checkForTag",
						method: "POST",
					},
					params: {
						name: {type: "string", min: 2},
					},
					handler: async (ctx: Context<CheckForTagParams>): Promise<string> => await this.checkForTag(ctx),
				},
			},
		}, schema));
	}

	public async checkForTag(ctx: Context<CheckForTagParams>): Promise<string> {
		const tagName = ctx.params.name;
		this.logger.info(`Checking if ${tagName} exists in the DB.`);
		try {
			const tags = await ctx.call("v1.tags.find", { query: { name: tagName } }) as Tag[];
			if (tags.length === 1) {
				const tag = tags[0];
				return tag.id;
			} else if (tags.length === 0) {
				this.logger.info(`Creating tag: ${tagName}`);
				const tag = await ctx.call("v1.tags.create", { name: tagName }) as Tag;
				return tag.id;
			} else {
				throw new BaseError("Duplicate ID for tag. HOW ?!? o_O", 500);
			}
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to check id for tag.", error.code || 500, this.name);
		}
	}

	public async getByString(ctx: Context<GetByStringParams>): Promise<Tag[]> {
		const name = ctx.params.name;
		try {
			return await ctx.call("v1.tags.find", { query: { name: { $regex: name, $options: "i" } } }) as Tag[];
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to get possible tags by name.", error.code || 500, this.name);
		}
	}
}
