"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { FavoriteData, MAX_PAGE_SIZE, PAGE_SIZE } from "../../shared";
import { Recipe, FavoriteResponse } from "../../types";

export default class FavoriteService extends Service {
    private DBConnection = new Connection("favorites").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "favorite",
            version: 1,
            mixins: [this.DBConnection],
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
				getOwnFavorties: {
					rest: {
						path: "/getOwnFavorties",
						method: "GET",
					},
					async handler(ctx): Promise<Recipe[]> {
						return await this.getFavorites(ctx.meta.user.id);
					},
				},
				/**
				 * Get the favorites of any user.
				 *
				 * @method
				 * @param {String} id - the user id to fetch favorites from
				 * @returns {Array<Recipe>} - The favorited recipes of the user
				 */
				getFavorties: {
					rest: {
						path: "/getFavorties",
						method: "POST",
					},
					params: {
						id: "string",
					},
					async handler(ctx): Promise<Recipe[]> {
						return await this.getFavorites(ctx.params.id);
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
					async handler(ctx): Promise<FavoriteResponse> {
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
					async handler(ctx): Promise<FavoriteResponse> {
						return await this.removeFavorite(ctx.meta.user.id, ctx.params.recipeID);
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
					handler: async (ctx: Context<any>) => {
						const userIds = (await ctx.call("v1.favorite.find", { fields: "userid" }) as FavoriteData[]).map(e => e.userid);
						for (const id of userIds) {
							this.removeFavorite(id, ctx.params.recipeID);
						}
					},
				},
			},
		}, schema));
	}

	public async getFavorites(userID: string): Promise<Recipe[]> {
		const favorites = (await this.getFavoriteData(userID)).favorites;
		const out = new Array<Recipe>();
		for (const id of favorites) {
			this.logger.info(`User[${userID}] Getting recipe for recipe id: ${id}`);
			out.push(await this.broker.call("v1.recipe-provider.getById", { id }));
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
			this.logger.info(`User[${userID}] Adding to favorites: ${recipeID}`);
			await this.broker.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
			return { success: true, method: "add", msg: `Recipe (${recipeID}) add to users (${userID}) favorites` } as FavoriteResponse;
		} else {
			this.logger.info(`User[${userID}] Creating new FavoriteData for user.`);
			await this.broker.call("v1.favorite.create", { userid: userID, favorites: [recipeID] });
			return { success: true, method: "add", msg: `Created favorites for user (${userID}) with recipe (${recipeID})` } as FavoriteResponse;
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
			this.logger.info(`User[${userID}] Removing recipe: ${recipeID}`);
			await this.broker.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
			return { success: true, method: "remove", msg: `Remove recipe from user(${userID}) favorites`} as FavoriteResponse;
		} else {
			this.logger.warn(`User[${userID}] User has no favorites.`);
			return { success: false, method: "remove", msg: `Couldn't remove recipe since user(${userID}) has no favorites`} as FavoriteResponse;
		}
	}

	private async getFavoriteData(userID: string): Promise<FavoriteData> {
		this.logger.info(`User[${userID}] Getting FavoriteData`);
		return (await this.broker.call("v1.favorite.find", { query: { userid: userID } }) as FavoriteData[])[0];
	}
}
