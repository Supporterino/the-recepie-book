"use strict";

import {Service, ServiceBroker} from "moleculer";

export default class RecipeCreationService extends Service {

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "recipe-creation",
            version: 1,
			actions:{
				/**
				 * Receive new recipe and trigger the saving process via the `data-store` service
				 */
				create_recipe: {
					rest: {
						method: "POST",
						path: "/create_recipe",
					},
					params: {
						name: "string",
						description: {type: "string", optional: true},
						ingredients: {type: "array", items: {type: "object", strict: true, props: {name: "string", amount: "number", unit: "string"}}},
						steps: {type: "array", items: "string"},
						rating: {type: "number", optional: true},
						tags: {type: "array", items: "string"},
						owner: "string",
					},
					async handler(ctx): Promise<string> {
						return await this.createRecipe(ctx.params);
					},
				},
			}
		});
	}

	public async createRecipe(params: any): Promise<string> {
		params.tags = await this.parseTagsToID(params.tags)
		await this.broker.call('v1.data-store.create', params)
		return `Saved recipe (${params.name}) by ${params.owner}`
	}

	private async parseTagsToID(tags: string[]): Promise<string[]> {
		const output: string[] = []
		for (const tag of tags) {
			output.push(await this.broker.call("v1.tags.check_for_tag", {name: tag}))
		}
		return output
	}
}
