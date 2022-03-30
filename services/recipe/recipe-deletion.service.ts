"use strict";

import { Service, ServiceBroker} from "moleculer";
import { Recipe } from "../../types/recipe";

export default class RecipeDeletionService extends Service {
	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-deletion",
            version: 1,
			actions:{
				deleteRecipe: {
					rest: {
						path: "/deleteRecipe",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx): Promise<boolean> {
						return await this.delete(ctx.params.recipeID, ctx.meta.user.id);
					},
				},
			},
		});
	}

	public async delete(recipeID: string, userID: string): Promise<boolean> {
		if (userID !== (await this.broker.call("v1.data-store.get", { id: recipeID }) as Recipe).owner) {return false;}
		this.broker.emit("recipe.deletion", { recipeID });
		return true;
	}
}
