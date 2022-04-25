"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { AddRecentParams, BaseError, DatabaseError, FetchError, FetchTarget, MAX_PAGE_SIZE, PAGE_SIZE, RecentData, RECENTS_SIZE, ServiceMeta } from "../../shared";
import { Recipe } from "../../types";

export default class RecentService extends Service {
    private DBConnection = new Connection("recents").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "recent",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"userid",
					"recents",
				],
				entityValidator: {
					userid: "string",
					recents: { type: "array", items: "string" },
				},
			},
			actions: {
				getRecents: {
					rest: {
						path: "/getRecents",
						method: "GET",
					},
					handler: async (ctx: Context<null, ServiceMeta>): Promise<Recipe[]> => await this.getRecents(ctx),
				},
			},
			events: {
				"user.recentAdd": {
					params: {
						recipeID: "string",
						userID: "string",
					},
					handler: async (ctx: Context<AddRecentParams>) => this.addRecent(ctx),
				},
			},
		}, schema));
	}

	public async getRecents(ctx: Context<null, ServiceMeta>): Promise<Recipe[]> {
		const userID = ctx.meta.user.id;
		const recentsOfUser = (await this.getRecentData(userID, ctx));
		const out = new Array<Recipe>();
		if (!recentsOfUser) {return out;}
		for (const id of recentsOfUser.recents.reverse()) {
			try {
				this.logger.info(`User[${userID}] Getting recipe for recipe id: ${id}`);
				out.push(await ctx.call("v1.recipe-provider.getById", { recipeID: id }));
			} catch (error) {
				if (error instanceof BaseError) {throw error;}
				else {
					throw new FetchError(error.message || "Failed to load favorited recipes by ID", error.code || 500, FetchTarget.RECIPE_PROVIDER);
				}
			}
		}
		return out;
	}

	public async addRecent(ctx: Context<AddRecentParams>): Promise<void> {
		const [ userID, recipeID ] = [ ctx.params.userID, ctx.params.recipeID ];
		const recentsOfUser = await this.getRecentData(userID, ctx);
		if (recentsOfUser) {
			const index = recentsOfUser.recents.indexOf(recipeID);
			if (index !== -1) {
				recentsOfUser.recents.splice(index, 1);
			}
			recentsOfUser.recents.push(recipeID);
			if (recentsOfUser.recents.length > RECENTS_SIZE) {recentsOfUser.recents.shift();}
			try {
				this.logger.info(`User[${userID}] Adding to recents: ${recipeID}`);
				await ctx.call("v1.recent.update", { id: recentsOfUser.id, recents: recentsOfUser.recents });
			} catch (error) {
				throw new DatabaseError(error.message || "Update call via add failed.", error.code || 500, this.name);
			}
		} else {
			try {
				this.logger.info(`User[${userID}] Creating new RecentData for user.`);
				await ctx.call("v1.recent.create", { userid: userID, recents: [recipeID] });
			} catch (error) {
				throw new DatabaseError(error.message || "Creation of RecentData failed.", error.code || 500, this.name);
			}
		}
	}

	private async getRecentData(userID: string, ctx: Context<any, any>): Promise<RecentData> {
		this.logger.info(`User[${userID}] Getting RecentData`);
		try {
			const data = (await ctx.call("v1.recent.find", { query: { userid: userID } }) as RecentData[])[0];
			return data;
		} catch (error) {
			throw new DatabaseError(error.message || "Fetching of data via find failed", error.code || 500, this.name);
		}
	}
}
