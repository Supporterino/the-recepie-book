"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { FavoriteResponse } from "../../types/favorite-response";
import { Recipe } from "../../types/recipe";

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
				pageSize: 2147483647,
				maxPageSize: 2147483647,
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
				getOwnFavorties: {
					rest: {
						path: "/getOwnFavorties",
						method: "GET",
					},
					async handler(ctx): Promise<Recipe[]> {
						return await this.getFavorites(ctx.meta.user.id);
					},
				},
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
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<any>) => {
						const userIds = (await ctx.call("v1.favorite.find", { populate: "userid" }) as FavoritePayload[]).map(e => e.userid);
						for (const id of userIds) {
							this.removeFavorite(id, ctx.params.recipeID);
						}
					},
				},
			},
		}, schema));
	}

	public async getFavorites(userID: string): Promise<Recipe[]> {
		const favorites = (await this.broker.call("v1.favorite.find", { query: { userid: userID } }) as FavoritePayload[])[0].favorites;
		const out = new Array<Recipe>();
		for (const id of favorites) {
			out.push(await this.broker.call("v1.recipe-provider.getById", { id }));
		}
		return out;
	}

	public async addFavorite(userID: string, recipeID: string): Promise<FavoriteResponse> {
		const favoritesOfUser = (await this.broker.call("v1.favorite.find", { query: { userid: userID } }) as FavoritePayload[])[0];
		if (favoritesOfUser) {
			if (favoritesOfUser.favorites.indexOf(recipeID) !== -1) {return { success: false, method: "add", msg: `Couldn't add recipe (${recipeID}) already present` } as FavoriteResponse;}
			favoritesOfUser.favorites.push(recipeID);
			await this.broker.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
			return { success: true, method: "add", msg: `Recipe (${recipeID}) add to users (${userID}) favorites` } as FavoriteResponse;
		} else {
			await this.broker.call("v1.favorite.create", { userid: userID, favorites: [recipeID] });
			return { success: true, method: "add", msg: `Created favorites for user (${userID}) with recipe (${recipeID})` } as FavoriteResponse;
		}
	}

	public async removeFavorite(userID: string, recipeID: string): Promise<FavoriteResponse> {
		const favoritesOfUser = (await this.broker.call("v1.favorite.find", { query: { userid: userID } }) as FavoritePayload[])[0];
		if (favoritesOfUser) {
			const index = favoritesOfUser.favorites.indexOf(recipeID);
			if (index === -1) {return { success: false, method: "remove", msg: `Couldn't remove recipe since it isn't in users(${userID}) favorites`} as FavoriteResponse;}
			favoritesOfUser.favorites.splice(index, 1);
			await this.broker.call("v1.favorite.update", { id: favoritesOfUser.id, favorites: favoritesOfUser.favorites });
			return { success: true, method: "remove", msg: `Remove recipe from user(${userID}) favorites`} as FavoriteResponse;
		} else {
			return { success: false, method: "remove", msg: `Couldn't remove recipe since user(${userID}) has no favorites`} as FavoriteResponse;
		}
	}
}

interface FavoritePayload {
	id: string;
	userid: string;
	favorites: string[];
}

