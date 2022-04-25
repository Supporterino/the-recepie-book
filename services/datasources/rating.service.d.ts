import { Context, Service, ServiceBroker, ServiceSchema } from "moleculer";
import {
	AddRatingParams,
	GetRatingForUserParams,
	RecipeDeletionParams,
	RemoveRatingParams,
	ServiceMeta,
	UpdateRatingParams,
} from "../../shared";
import { RatingResponse } from "../../types";

declare class RatingService extends Service {
	public constructor(broker: ServiceBroker, schema: ServiceSchema<{}>);

	/**
	 * Event to handle the deletion of {@link RatingData} when a recipe is deleted.
	 *
	 * @event
	 */
	public "recipe.deletion"(ctx: Context<RecipeDeletionParams>): Promise<void>;

	/**
	 * Get the rating of a user from a specific recipe.
	 *
	 * @method
	 * @param {String} recipeID
	 * @returns {Number}
	 */
	public getRatingForUser(
		ctx: Context<GetRatingForUserParams, ServiceMeta>
	): Promise<number>;

	/**
	 * Remove a rating from a recipe.
	 *
	 * @method
	 * @param {String} recipeID - The recipe id to remove the rating from
	 * @returns {RatingResponse}
	 */
	public removeRating(
		ctx: Context<RemoveRatingParams, ServiceMeta>
	): Promise<RatingResponse>;

	/**
	 * Add a new rating to a recipe.
	 *
	 * @method
	 * @param {String} recipeID - The recipe id to add a new rating
	 * @param {Number} rating - The value of the new rating
	 * @returns {RatingResponse}
	 */
	public addRating(
		ctx: Context<AddRatingParams, ServiceMeta>
	): Promise<RatingResponse>;

	/**
	 * Update a rating of a recipe.
	 *
	 * @method
	 * @param {String} recipeID - The recipe id to modify the rating of
	 * @param {Number} rating - The updated rating value
	 * @returns {RatingResponse}
	 */
	public updateRating(
		ctx: Context<UpdateRatingParams, ServiceMeta>
	): Promise<RatingResponse>;
}

export = RatingService;
