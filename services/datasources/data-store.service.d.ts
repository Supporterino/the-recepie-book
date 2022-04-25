import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	FirstRatingParams,
	RecipeDeletionParams,
	RecipePictureUpdateParams,
} from "../../shared";

declare class DataStoreService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Event which is triggered once a recipe receives its first rating. The event is used to assign the ratingID to the recipe
	 *
	 * @event
	 * @param {string} recipeID
	 * @param {string} ratingID
	 */
	public "recipe.first_rating"(ctx: Context<FirstRatingParams>): void;

	/**
	 * Event to handle the deletion of a recipe.
	 *
	 * @event
	 * @param {stirng} recipeID
	 */
	public "recipe.deletion"(ctx: Context<RecipeDeletionParams>): void;

	/**
	 * This event is triggered when the upload of a picture {@link PhotoService} was successful and the target was a recipe. If a old picture is present it gets deleted.
	 *
	 * @event
	 * @param {string} recipeID
	 * @param {string} imageName
	 */
	public "recipe.newPicutre"(
		ctx: Context<RecipePictureUpdateParams>
	): Promise<void>;
}

export = DataStoreService;
