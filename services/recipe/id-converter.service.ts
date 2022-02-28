"use strict";

import { Service, ServiceBroker} from "moleculer";
import { Recipe } from "../../types/recipe";
import { Tag } from "../../types/tag";
import { Units } from "../../types/units";
import { User } from "../../types/user";

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
			},
		});
	}

	public async convertRecipes(recipes: Recipe[]): Promise<Recipe[]> {
		const out = new Array<Recipe>();
        for (const recipe of recipes) {
            out.push(await this.broker.call("v1.id-converter.convertRecipe", {recipe}));
        }
        return recipes;
    }

    public async convertRecipe(recipe: Recipe): Promise<Recipe> {
        const tagNames = new Array<string>();
        for (const tag of recipe.tags) {
            tagNames.push((await this.broker.call("v1.tags.get", { id: tag }) as Tag).name);
        }
        recipe.tags = tagNames;
		recipe.owner = (await this.broker.call("v1.user.get", { id: recipe.owner }) as User).username;
        return recipe;
    }
}
