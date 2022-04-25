"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { AddToCookListParams, BaseError, CookListData, DatabaseError, FetchError, FetchTarget, IsOnCookListParams, MAX_PAGE_SIZE, PAGE_SIZE, RecipeDeletionParams, RemoveFromCookListParams, ServiceMeta } from "../../shared";
import { CookListResponse, Recipe } from "../../types";

export default class CookListService extends Service {
    private DBConnection = new Connection("cooklist").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "cooklist",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"userid",
					"recipes",
				],
				entityValidator: {
					userid: "string",
					recipes: { type: "array", items: "string" },
				},
			},
			actions: {
				getCookList: {
					rest: {
						path: "/getCookList",
						method: "GET",
					},
					handler: async (ctx: Context<null, ServiceMeta>): Promise<Recipe[]> => await this.getCookList(ctx),
				},
				 addToCookList: {
					rest: {
						path: "/addToCookList",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<AddToCookListParams, ServiceMeta>): Promise<CookListResponse> =>  await this.addToCookList(ctx),
				},
				 removeFromCookList: {
					rest: {
						path: "/removeFromCookList",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RemoveFromCookListParams, ServiceMeta>): Promise<CookListResponse> => await this.removeFromCookList(ctx),
				},
				 isOnCookList: {
					rest: {
						path: "/isOnCookList",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<IsOnCookListParams, ServiceMeta>): Promise<boolean> => await this.isOnCookList(ctx),
				},
			},
			events: {
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RecipeDeletionParams, ServiceMeta>): Promise<void> => this["recipe.deletion"](ctx),
				},
			},
		}, schema));
	}

	public async "recipe.deletion"(ctx: Context<RecipeDeletionParams, ServiceMeta>): Promise<void> {
		const userIds = (await ctx.call("v1.cooklist.find", { fields: "userid" }) as CookListData[]).map(e => e.userid);
		for (const id of userIds) {
			this.removeFromCookList(ctx, id, ctx.params.recipeID);
		}
	}

	public async isOnCookList(ctx: Context<IsOnCookListParams, ServiceMeta>): Promise<boolean> {
		const [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];
		const cookListData = (await this.getCookListData(userID, ctx));
		if (!cookListData) {return false;}
		return cookListData.recipes.findIndex(entry => entry === recipeID) !== -1;
	}

	public async getCookList(ctx: Context<null, ServiceMeta>): Promise<Recipe[]> {
		const userID = ctx.meta.user.id;
		const cookListData = (await this.getCookListData(userID, ctx));
		const out = new Array<Recipe>();
		if (!cookListData) {return out;}
		for (const id of cookListData.recipes) {
			try {
				this.logger.info(`User[${userID}] Getting recipe for recipe id: ${id}`);
				out.push(await ctx.call("v1.recipe-provider.getById", { recipeID: id }));
			} catch (error) {
				if (error instanceof BaseError) {throw error;}
				else {
					throw new FetchError(error.message || "Failed to load cook list recipes by ID", error.code || 500, FetchTarget.RECIPE_PROVIDER);
				}
			}
		}
		return out;
	}

	public async addToCookList(ctx: Context<AddToCookListParams, ServiceMeta>): Promise<CookListResponse> {
		const [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];
		const cookListData = await this.getCookListData(userID, ctx);
		if (cookListData) {
			if (cookListData.recipes.indexOf(recipeID) !== -1) {
				this.logger.warn(`User[${userID}] tried to add recipe (${recipeID}) which is already present.`);
				return { success: false, msg: `Couldn't add recipe (${recipeID}) already present` } as CookListResponse;
			}
			cookListData.recipes.push(recipeID);
			try {
				this.logger.info(`User[${userID}] Adding to cook list: ${recipeID}`);
				await ctx.call("v1.cooklist.update", { id: cookListData.id, recipes: cookListData.recipes });
				return { success: true, msg: `Recipe (${recipeID}) add to users (${userID}) recipes` } as CookListResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Update call via add failed.", error.code || 500, this.name);
			}
		} else {
			try {
				this.logger.info(`User[${userID}] Creating new CookListData for user.`);
				await ctx.call("v1.cooklist.create", { userid: userID, recipes: [recipeID] });
				return { success: true, msg: `Created cook list for user (${userID}) with recipe (${recipeID})` } as CookListResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Creation of CookListData failed.", error.code || 500, this.name);
			}
		}
	}

	public async removeFromCookList(ctx: Context<RemoveFromCookListParams, ServiceMeta>, userID?: string, recipeID?: string): Promise<CookListResponse> {
		if (!userID && !recipeID){ [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];}
		const cookListData = await this.getCookListData(userID, ctx);
		if (cookListData) {
			const index = cookListData.recipes.indexOf(recipeID);
			if (index === -1) {
				this.logger.warn(`User[${userID}] Can't remove non present recipe: ${recipeID}`);
				return { success: false, msg: `Couldn't remove recipe since it isn't in users(${userID}) cook list`} as CookListResponse;
			}
			cookListData.recipes.splice(index, 1);
			try {
				this.logger.info(`User[${userID}] Removing recipe: ${recipeID}`);
				await ctx.call("v1.cooklist.update", { id: cookListData.id, recipes: cookListData.recipes });
				return { success: true, msg: `Remove recipe from user(${userID}) cook list`} as CookListResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Updating of cook list data failed (update call).", error.code || 500, this.name);
			}
		} else {
			this.logger.warn(`User[${userID}] User has no cook list.`);
			return { success: false, msg: `Couldn't remove recipe since user(${userID}) has no cook list`} as CookListResponse;
		}
	}

	private async getCookListData(userID: string, ctx: Context<any>): Promise<CookListData> {
		this.logger.info(`User[${userID}] Getting CookList`);
		try {
			const data = (await ctx.call("v1.cooklist.find", { query: { userid: userID } }) as CookListData[])[0];
			return data;
		} catch (error) {
			throw new DatabaseError(error.message || "Fetching of data via find failed", error.code || 500, this.name);
		}
	}
}
