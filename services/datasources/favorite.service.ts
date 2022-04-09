"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { BaseError, DatabaseError, FavoriteData, FetchError, FetchTarget, MAX_PAGE_SIZE, PAGE_SIZE, RecipeDeletionParams, ServiceMeta } from "../../shared";
import { AddFavoriteParams, GetFavoriteParams, IsFavoriteParams, RemoveFavoriteParams } from "../../shared/services/favorite.types";
import { Recipe, FavoriteResponse } from "../../types";

export default class FavoriteService extends Service {
    private DBConnection = new Connection("favorites").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "favorite",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"userid",
					"favorites",
				],
				entityValidator: {
					userid: "string",
					favorites: { type: "array", items: "string" },
				},
			},
			actions: {
				/**
				 * Get's the favorites for user making the request. User id is sourced from meta payload.
				 *
				 * @method
				 * @returns {Array<Recipe>} - The favorited recipes of the user
				 */
				getOwnFavorites: {
					rest: {
						path: "/getOwnFavorites",
						method: "GET",
					},
					async handler(ctx: Context<null, ServiceMeta>): Promise<Recipe[]> {
						return await this.getFavorites(ctx.meta.user.id, ctx.meta);
					},
				},
				/**
				 * Get the favorites of any user.
				 *
				 * @method
				 * @param {String} id - the user id to fetch favorites from
				 * @returns {Array<Recipe>} - The favorited recipes of the user
				 */
				getFavorites: {
					rest: {
						path: "/getFavorites",
						method: "POST",
					},
					params: {
						userID: "string",
					},
					async handler(ctx: Context<GetFavoriteParams, ServiceMeta>): Promise<Recipe[]> {
						return await this.getFavorites(ctx.params.userID, ctx.meta);
					},
				},
				/**
				 * Adds a new recipe to the favorites of the user.
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to add.
				 * @returns {FavoriteResponse}
				 */
				addFavorite: {
					rest: {
						path: "/addFavorite",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<AddFavoriteParams, ServiceMeta>): Promise<FavoriteResponse> {
						return await this.addFavorite(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
				/**
				 * Remove a new recipe fromt the favorites of the user.
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to remove.
				 * @returns {FavoriteResponse}
				 */
				removeFavorite: {
					rest: {
						path: "/removeFavorite",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<RemoveFavoriteParams, ServiceMeta>): Promise<FavoriteResponse> {
						return await this.removeFavorite(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
				/**
				 * Check if a recipe is favorited
				 *
				 * @method
				 * @param {String} recipeID - The id of the recipe to check.
				 * @returns {FavoriteResponse}
				 */
				 isFavorite: {
					rest: {
						path: "/isFavorited",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<IsFavoriteParams, ServiceMeta>): Promise<boolean> {
						return await this.isFavorite(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
			},
			events: {
				/**
				 * Event to handle the deletion of {@link FavoriteData} when a recipe is deleted.
				 *
				 * @event
				 */
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RecipeDeletionParams>) => {
						const userIds = (await ctx.call("v1.favorite.find", { fields: "userid" }) as FavoriteData[]).map(e => e.userid);
						for (const id of userIds) {
							this.removeFavorite(id, ctx.params.recipeID);
						}
					},
				},
			},
		}, schema));
	}

	public async isFavorite(userID: string, recipeID: string): Promise<boolean> {
		const favoriteData = (await this.getFavoriteData(userID));
		if (!favoriteData) {return false;}
		if (favoriteData.favorites.findIndex(entry => entry === recipeID) === -1) {return false;}
		else {return true;}
	}

	public async getFavorites(userID: string, meta: ServiceMeta = null): Promise<Recipe[]> {
		const favoriteData = (await this.getFavoriteData(userID));
		const out = new Array<Recipe>();
		if (!favoriteData) {return out;}
		for (const id of favoriteData.favorites) {
			try {
				this.logger.info(`User[${userID}] Getting recipe for recipe id: ${id}`);
				out.push(await this.broker.call("v1.recipe-provider.getById", { recipeID: id }, { meta }));
			} catch (error) {
				if (error instanceof BaseError) {throw error;}
				else {
					throw new FetchError(error.message || "Failed to load favorited recipes by ID", error.code || 500, FetchTarget.RECIPE_PROVIDER);
				}
			}
		}
		return out;
	}

	public async addFavorite(userID: string, recipeID: string): Promise<FavoriteResponse> {
		const favoritesOfUser = await this.getFavoriteData(userID);
		if (favoritesOfUser) {
			if (favoritesOfUser.favorites.indexOf(recipeID) !== -1) {
				this.logger.warn(`User[${userID}] tried to add recipe (${recipeID}) which is already present.`);
				return { success: false, method: "add", msg: `Couldn't add recipe (${recipeID}) already present` } as FavoriteResponse;
			}
			favoritesOfUser.favorites.push(recipeID);
			try {
				this.logger.info(`User[${userID}] Adding to favorites: ${recipeID}`);
				await this.broker.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
				return { success: true, method: "add", msg: `Recipe (${recipeID}) add to users (${userID}) favorites` } as FavoriteResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Update call via add failed.", error.code || 500, this.name);
			}
		} else {
			try {
				this.logger.info(`User[${userID}] Creating new FavoriteData for user.`);
				await this.broker.call("v1.favorite.create", { userid: userID, favorites: [recipeID] });
				return { success: true, method: "add", msg: `Created favorites for user (${userID}) with recipe (${recipeID})` } as FavoriteResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Creation of FavoriteData failed.", error.code || 500, this.name);
			}
		}
	}

	public async removeFavorite(userID: string, recipeID: string): Promise<FavoriteResponse> {
		const favoritesOfUser = await this.getFavoriteData(userID);
		if (favoritesOfUser) {
			const index = favoritesOfUser.favorites.indexOf(recipeID);
			if (index === -1) {
				this.logger.warn(`User[${userID}] Can't remove non present recipe: ${recipeID}`);
				return { success: false, method: "remove", msg: `Couldn't remove recipe since it isn't in users(${userID}) favorites`} as FavoriteResponse;
			}
			favoritesOfUser.favorites.splice(index, 1);
			try {
				this.logger.info(`User[${userID}] Removing recipe: ${recipeID}`);
				await this.broker.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
				return { success: true, method: "remove", msg: `Remove recipe from user(${userID}) favorites`} as FavoriteResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Updating of favorite data failed (update call).", error.code || 500, this.name);
			}
		} else {
			this.logger.warn(`User[${userID}] User has no favorites.`);
			return { success: false, method: "remove", msg: `Couldn't remove recipe since user(${userID}) has no favorites`} as FavoriteResponse;
		}
	}

	private async getFavoriteData(userID: string): Promise<FavoriteData> {
		this.logger.info(`User[${userID}] Getting FavoriteData`);
		try {
			const data = (await this.broker.call("v1.favorite.find", { query: { userid: userID } }) as FavoriteData[])[0];
			return data;
		} catch (error) {
			throw new DatabaseError(error.message || "Fetching of data via find failed", error.code || 500, this.name);
		}
	}
}
