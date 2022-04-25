"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { AddFavoriteParams, BaseError, DatabaseError, FavoriteData, FetchError, FetchTarget, GetFavoriteParams, IsFavoriteParams, MAX_PAGE_SIZE, PAGE_SIZE, RecipeDeletionParams, RemoveFavoriteParams, ServiceMeta } from "../../shared";
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
				getOwnFavorites: {
					rest: {
						path: "/getOwnFavorites",
						method: "GET",
					},
					handler: async (ctx: Context<null, ServiceMeta>): Promise<Recipe[]> => await this.getFavorites(ctx),
				},
				getFavorites: {
					rest: {
						path: "/getFavorites",
						method: "POST",
					},
					params: {
						userID: "string",
					},
					handler: async (ctx: Context<null, ServiceMeta>): Promise<Recipe[]> => await this.getFavorites(ctx),
				},
				addFavorite: {
					rest: {
						path: "/addFavorite",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<AddFavoriteParams, ServiceMeta>): Promise<FavoriteResponse> => this.addFavorite(ctx),
				},
				removeFavorite: {
					rest: {
						path: "/removeFavorite",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RemoveFavoriteParams, ServiceMeta>): Promise<FavoriteResponse> => await this.removeFavorite(ctx),
				},
				isFavorite: {
					rest: {
						path: "/isFavorited",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<IsFavoriteParams, ServiceMeta>): Promise<boolean> => await this.isFavorite(ctx),
				},
			},
			events: {
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RecipeDeletionParams, ServiceMeta>) => this["recipe.deletion"](ctx),
				},
			},
		}, schema));
	}

	public async "recipe.deletion"(ctx: Context<RecipeDeletionParams, ServiceMeta>): Promise<void> {
		const userIds = (await ctx.call("v1.favorite.find", { fields: "userid" }) as FavoriteData[]).map(e => e.userid);
		for (const id of userIds) {
			this.removeFavorite(ctx, id, ctx.params.recipeID);
		}
	}

	public async isFavorite(ctx: Context<IsFavoriteParams, ServiceMeta>): Promise<boolean> {
		const [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];
		const favoriteData = (await this.getFavoriteData(userID, ctx));
		if (!favoriteData) {return false;}
		return favoriteData.favorites.findIndex(entry => entry === recipeID) !== -1;
	}

	public async getFavorites(ctx: Context<GetFavoriteParams, ServiceMeta>): Promise<Recipe[]> {
		const userID = ctx.params?.userID || ctx.meta.user.id;
		const favoriteData = (await this.getFavoriteData(userID, ctx));
		const out = new Array<Recipe>();
		if (!favoriteData) {return out;}
		for (const id of favoriteData.favorites) {
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

	public async addFavorite(ctx: Context<AddFavoriteParams, ServiceMeta>): Promise<FavoriteResponse> {
		const [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ];
		const favoritesOfUser = await this.getFavoriteData(userID, ctx);
		if (favoritesOfUser) {
			if (favoritesOfUser.favorites.indexOf(recipeID) !== -1) {
				this.logger.warn(`User[${userID}] tried to add recipe (${recipeID}) which is already present.`);
				return { success: false, method: "add", msg: `Couldn't add recipe (${recipeID}) already present` } as FavoriteResponse;
			}
			favoritesOfUser.favorites.push(recipeID);
			try {
				this.logger.info(`User[${userID}] Adding to favorites: ${recipeID}`);
				await ctx.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
				return { success: true, method: "add", msg: `Recipe (${recipeID}) add to users (${userID}) favorites` } as FavoriteResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Update call via add failed.", error.code || 500, this.name);
			}
		} else {
			try {
				this.logger.info(`User[${userID}] Creating new FavoriteData for user.`);
				await ctx.call("v1.favorite.create", { userid: userID, favorites: [recipeID] });
				return { success: true, method: "add", msg: `Created favorites for user (${userID}) with recipe (${recipeID})` } as FavoriteResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Creation of FavoriteData failed.", error.code || 500, this.name);
			}
		}
	}

	public async removeFavorite(ctx: Context<RemoveFavoriteParams, ServiceMeta>, userID?: string, recipeID?: string): Promise<FavoriteResponse> {
		if (!userID && !recipeID ) { [ userID, recipeID ] = [ ctx.meta.user.id, ctx.params.recipeID ]; }
		const favoritesOfUser = await this.getFavoriteData(userID, ctx);
		if (favoritesOfUser) {
			const index = favoritesOfUser.favorites.indexOf(recipeID);
			if (index === -1) {
				this.logger.warn(`User[${userID}] Can't remove non present recipe: ${recipeID}`);
				return { success: false, method: "remove", msg: `Couldn't remove recipe since it isn't in users(${userID}) favorites`} as FavoriteResponse;
			}
			favoritesOfUser.favorites.splice(index, 1);
			try {
				this.logger.info(`User[${userID}] Removing recipe: ${recipeID}`);
				await ctx.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
				return { success: true, method: "remove", msg: `Remove recipe from user(${userID}) favorites`} as FavoriteResponse;
			} catch (error) {
				throw new DatabaseError(error.message || "Updating of favorite data failed (update call).", error.code || 500, this.name);
			}
		} else {
			this.logger.warn(`User[${userID}] User has no favorites.`);
			return { success: false, method: "remove", msg: `Couldn't remove recipe since user(${userID}) has no favorites`} as FavoriteResponse;
		}
	}

	private async getFavoriteData(userID: string, ctx: Context<any, any>): Promise<FavoriteData> {
		this.logger.info(`User[${userID}] Getting FavoriteData`);
		try {
			const data = (await ctx.call("v1.favorite.find", { query: { userid: userID } }) as FavoriteData[])[0];
			return data;
		} catch (error) {
			throw new DatabaseError(error.message || "Fetching of data via find failed", error.code || 500, this.name);
		}
	}
}
