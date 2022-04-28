"use strict";

import {Context, Service, ServiceBroker} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { FirstRating, MAX_PAGE_SIZE, PAGE_SIZE, RecipeData, RecipeDeletion, RecipePictureUpdate } from "../../shared";
import { Units } from "../../types";
export default class DataStoreService extends Service {
	private DBConnection = new Connection("recipes").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "data-store",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"name",
					"description",
					"ingredients",
					"steps",
					"rating",
					"tags",
					"owner",
					"picture",
					"creationTimestamp",
					"updateTimestamp",
				],
				entityValidator: {
					name: "string",
					description: {type: "string", default: "", optional: true},
					ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
					steps: {type: "array", items: "string"},
					rating: { type: "string", default: "", optional: true },
					tags: {type: "array", items: "string"},
					owner: "string",
					picture: { type: "string", default: "NO_PIC", optional: true },
					creationTimestamp: { type: "date", convert: true },
					updateTimestamp: { type: "date", convert: true },
				},
			},
			events: {
				"recipe.first_rating": {
					params: {
						recipeID: "string",
						ratingID: "string",
					},
					handler: (ctx: Context<FirstRating>): void => this["recipe.first_rating"](ctx),
				},
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: (ctx: Context<RecipeDeletion>): void => this["recipe.deletion"](ctx),
				},
				"recipe.newPicutre": {
					params: {
						recipeID: "string",
						imageName: "string",
					},
					handler: (ctx: Context<RecipePictureUpdate>): Promise<void> => this["recipe.newPicutre"](ctx),
				},
			},
		}, schema));
	}

	public "recipe.first_rating"(ctx: Context<FirstRating>): void {
		ctx.call("v1.data-store.update", { id: ctx.params.recipeID, rating: ctx.params.ratingID });
	}

	public "recipe.deletion"(ctx: Context<RecipeDeletion>): void {
		ctx.call("v1.data-store.remove", { id: ctx.params.recipeID });
	}

	public async "recipe.newPicutre"(ctx: Context<RecipePictureUpdate>): Promise<void> {
		const oldFile = (await ctx.call("v1.data-store.get", { id: ctx.params.recipeID }) as RecipeData).picture;
		await ctx.call("v1.data-store.update", { id: ctx.params.recipeID, picture: ctx.params.imageName });
		if (oldFile !== "NO_PIC") {ctx.emit("photo.delete", { fileName: oldFile });}
	}
}
