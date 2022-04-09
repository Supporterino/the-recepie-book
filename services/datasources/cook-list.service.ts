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
				/**
				 * Get's the to cook list for user making the request. User id is sourced from meta payload.
				 *
				 * @method
				 * @returns {Array<Recipe>} - The to cook recipes of the user
				 */
				getCookList: {
					rest: {
						path: "/getCookList",
						method: "GET",
					},
					async handler(ctx: Context<null, ServiceMeta>): Promise<Recipe[]> {
						return await this.getCookList(ctx.meta.user.id, ctx.meta);
					},
				},
				/**
				 * Adds a new recipe to the cook list of the user.
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to add.
				 * @returns {CookListResponse}
				 */
				 addToCookList: {
					rest: {
						path: "/addToCookList",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<AddToCookListParams, ServiceMeta>): Promise<CookListResponse> {
						return await this.addToCookList(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
				/**
				 * Remove a new recipe fromt the cook list of the user.
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to remove.
				 * @returns {CookListResponse}
				 */
				 removeFromCookList: {
					rest: {
						path: "/removeFromCookList",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<RemoveFromCookListParams, ServiceMeta>): Promise<CookListResponse> {
						return await this.removeFromCookList(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
				/**
				 * Check if a recipe is on cook list
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to check.
				 * @returns {boolean}
				 */
				 isOnCookList: {
					rest: {
						path: "/isOnCookList",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<IsOnCookListParams, ServiceMeta>): Promise<boolean> {
						return await this.isOnCookList(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
			},
			events: {
				/**
				 * Event to handle the deletion of {@link CookListData} when a recipe is deleted.
				 *
				 * @event
				 */
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RecipeDeletionParams>) => {
						const userIds = (await ctx.call("v1.cooklist.find", { fields: "userid" }) as CookListData[]).map(e => e.userid);
						for (const id of userIds) {
							this.removeCookList(id, ctx.params.recipeID);
						}
					},
				},
			},
		}, schema));
	}

	public async isOnCookList(userID: string, recipeID: string): Promise<boolean> {
		const cookListData = (await this.getCookListData(userID));
		if (!cookListData) {return false;}
		return cookListData.recipes.findIndex(entry => entry === recipeID) !== -1;
	}

	public async getCookList(userID: string, meta: ServiceMeta = null): Promise<Recipe[]> {
		const cookListData = (await this.getCookListData(userID));
		const out = new Array<Recipe>();
		if (!cookListData) {return out;}
		for (const id of cookListData.recipes) {
			try {
				this.logger.info(`User[${userID}] Getting recipe for recipe id: ${id}`);
				out.push(await this.broker.call("v1.recipe-provider.getById", { recipeID: id }, { meta }));
			} catch (error) {
				if (error instanceof BaseError) {throw error;}
				else {
					throw new FetchError(error.message || "Failed to load cook list recipes by ID", error.code || 500, FetchTarget.RECIPE_PROVIDER);
				}
			}
		}
		return out;
	}

	public async addToCookList(userID: string, recipeID: string): Promise<CookListResponse> {
		const cookListData = await this.getCookListData(userID);
		if (cookListData) {
			if (cookListData.recipes.indexOf(recipeID) !== -1) {
				this.logger.warn(`User[${userID}] tried to add recipe (${recipeID}) which is already present.`);
				return { success: false, msg: `Couldn't add recipe (${recipeID}) already present` } as CookListResponse;
			}
			cookListData.recipes.push(recipeID);
			try {
				this.logger.info(`User[${userID}] Adding to cook list: ${recipeID}`);
				await this.broker.call("v1.cooklist.update", { id: cookListData.id, favorites: cookListData.recipes });
				return { success: true, msg: `Recipe (${recipeID}) add to users (${userID}) favorites` } as CookListResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Update call via add failed.", error.code || 500, this.name);
			}
		} else {
			try {
				this.logger.info(`User[${userID}] Creating new CookListData for user.`);
				await this.broker.call("v1.cooklist.create", { userid: userID, recipes: [recipeID] });
				return { success: true, msg: `Created cook list for user (${userID}) with recipe (${recipeID})` } as CookListResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Creation of CookListData failed.", error.code || 500, this.name);
			}
		}
	}

	public async removeFromCookList(userID: string, recipeID: string): Promise<CookListResponse> {
		const cookListData = await this.getCookListData(userID);
		if (cookListData) {
			const index = cookListData.recipes.indexOf(recipeID);
			if (index === -1) {
				this.logger.warn(`User[${userID}] Can't remove non present recipe: ${recipeID}`);
				return { success: false, msg: `Couldn't remove recipe since it isn't in users(${userID}) cook list`} as CookListResponse;
			}
			cookListData.recipes.splice(index, 1);
			try {
				this.logger.info(`User[${userID}] Removing recipe: ${recipeID}`);
				await this.broker.call("v1.cooklist.update", { id: cookListData.id, favorites: cookListData.recipes });
				return { success: true, msg: `Remove recipe from user(${userID}) favorites`} as CookListResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Updating of cook list data failed (update call).", error.code || 500, this.name);
			}
		} else {
			this.logger.warn(`User[${userID}] User has no cook list.`);
			return { success: false, msg: `Couldn't remove recipe since user(${userID}) has no cook list`} as CookListResponse;
		}
	}

	private async getCookListData(userID: string): Promise<CookListData> {
		this.logger.info(`User[${userID}] Getting CookList`);
		try {
			const data = (await this.broker.call("v1.cooklist.find", { query: { userid: userID } }) as CookListData[])[0];
			return data;
		} catch (error) {
			throw new DatabaseError(error.message || "Fetching of data via find failed", error.code || 500, this.name);
		}
	}
}
