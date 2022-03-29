"use strict";

import { Service, ServiceBroker} from "moleculer";
import { Recipe } from "../../types/recipe";
import { Tag } from "../../types/tag";
import { Units } from "../../types/units";
import { User } from "../../types/user";
import { RatingPayload } from "./rating.service";

export default class IDConverterService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "id-converter",
            version: 1,
			actions:{
				convertRecipe: {
					params: {
						recipe: { type: "object", props: {
							id: "string",
							name: "string",
							description: {type: "string"},
							ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
							steps: {type: "array", items: "string"},
							rating: {type: "number"},
							tags: {type: "array", items: "string"},
							owner: "string",
							creationTimestamp: { type: "date", convert: true },
							updateTimestamp: { type: "date", convert: true },
						} },
					},
					async handler(ctx): Promise<Recipe> {
						return await this.convertRecipe(ctx.params.recipe);
					},
				},
				convertRecipes: {
					params: {
						recipes: { type: "array", items: {type: "object", props: {
							id: "string",
							name: "string",
							description: {type: "string"},
							ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: { type: "enum", values: Object.values(Units) }}}},
							steps: {type: "array", items: "string"},
							rating: {type: "number"},
							tags: {type: "array", items: "string"},
							owner: "string",
							creationTimestamp: { type: "date", convert: true },
							updateTimestamp: { type: "date", convert: true },
						}} },
					},
					async handler(ctx): Promise<Recipe> {
						return await this.convertRecipes(ctx.params.recipes);
					},
				},
				convertTagsToID: {
					params: {
						tagNames: { type: "array", items: "string" },
					},
					async handler(ctx): Promise<string[]> {
						return await this.parseTagsToID(ctx.params.tagNames);
					},
				},
				convertTagsToName: {
					params: {
 						tagIDs: { type: "array", items: "string" },
					},
					async handler(ctx): Promise<string[]> {
						return await this.parseTagsToName(ctx.params.tagIDs);
					},
				},
				convertRatingIDtoRating: {
					params: {
						ratingID: "string",
					},
					async handler(ctx): Promise<number> {
						return await this.getRatingForRatingID(ctx.params.ratingID);
					},
				},
			},
		});
	}

	public async parseTagsToID(tagNames: string[]): Promise<string[]> {
		const output: string[] = [];
		for (const tagName of tagNames) {
			this.logger.debug(`Converting tag (${tagName}) to id`);
			output.push(await this.broker.call("v1.tags.checkForTag", {name: tagName}));
		}
		return output;
	}

	public async parseTagsToName(tagIDs: string[]): Promise<string[]> {
		const output: string[] = [];
		for (const tagID of tagIDs) {
			this.logger.debug(`Getting tag (${tagID}) as name`);
			output.push((await this.broker.call("v1.tags.get", { id: tagID }) as Tag).name);
		}
		return output;
	}

	public async getRatingForRatingID(ratingID: string): Promise<number> {
		const ratingPayload = await this.broker.call("v1.rating.get", { id: ratingID }) as RatingPayload;
		return ratingPayload.avgRating;
	}

	public async convertRecipes(recipes: Recipe[]): Promise<Recipe[]> {
		const out = new Array<Recipe>();
        for (const recipe of recipes) {
            out.push(await this.broker.call("v1.id-converter.convertRecipe", {recipe}));
        }
        return out;
    }

    public async convertRecipe(recipe: Recipe): Promise<Recipe> {
        recipe.tags = await this.broker.call("v1.id-converter.convertTagsToName", { tagIDs: recipe.tags });
		recipe.owner = (await this.broker.call("v1.user.get", { id: recipe.owner }) as User).username;
		recipe.rating = await this.broker.call("v1.id-converter.convertRatingIDtoRating", { ratingID: recipe.rating });
        return recipe;
    }
}
