import { Context, Service, ServiceBroker } from "moleculer";
import { CreationData, CreationResponse } from "../../types";
import { ServiceMeta } from "../../shared";

declare class RecipeCreationService extends Service {
	public constructor(broker: ServiceBroker);

	/**
	 * Validates the input and converts the tags to ids and sends a creation request to the `data-store` service
	 *
	 * @method
	 * @param {String} name - The name of the recipe
	 * @param {String} description - The description for the recipe
	 * @param {Array<string>} steps - The steps to make the recipe. Each step should be one element of the array
	 * @param {Array<Ingredient>} ingredients - A list of ingredients needed to make the recipe
	 * @param {Array<string} tags - A list of tag names to link to the recipe
	 * @param {String} owner - Name of the recipe owner
	 */
	public createRecipe(
		ctx: Context<CreationData, ServiceMeta>
	): Promise<CreationResponse>;
}

export = RecipeCreationService;
