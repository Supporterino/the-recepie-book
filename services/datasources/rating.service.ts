"use strict";

import {Context, Service, ServiceBroker, ServiceSchema} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { AddRatingParams, AuthError, DatabaseError, GetRatingForUserParams, MAX_PAGE_SIZE, PAGE_SIZE,RatingData, RatingEntry, RecipeDeletionParams, RemoveRatingParams, ServiceMeta, UpdateRatingParams } from "../../shared";
import { RatingResponse, RatingOperations } from "../../types";

export default class RatingService extends Service {
    private DBConnection = new Connection("ratings").start();

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "rating",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"recipeID",
					"ratings",
					"avgRating",
				],
				entityValidator: {
					recipeID: "string",
					ratings: { type: "array", items: { type: "object", strict: true, props: { userID: "string", rating: "number" }}},
					avgRating: { type: "number", nullable: true },
				},
			},
			actions: {
				/**
				 * Add a new rating to a recipe.
				 *
				 * @method
				 * @param {String} recipeID - The recipe id to add a new rating
				 * @param {Number} rating - The value of the new rating
				 * @returns {RatingResponse}
				 */
				addRating: {
					rest: {
						path: "/addRating",
						method: "POST",
					},
					params: {
						recipeID: "string",
						rating: "number",
					},
					async handler(ctx: Context<AddRatingParams, ServiceMeta>): Promise<RatingResponse> {
						return await this.addRating(ctx.meta.user.id, ctx.params.recipeID, ctx.params.rating);
					},
				},
				/**
				 * Update a rating of a recipe.
				 *
				 * @method
				 * @param {String} recipeID - The recipe id to modify the rating of
				 * @param {Number} rating - The updated rating value
				 * @returns {RatingResponse}
				 */
				updateRating: {
					rest: {
						path: "/updateRating",
						method: "PATCH",
					},
					params: {
						recipeID: "string",
						rating: "number",
					},
					async handler(ctx: Context<UpdateRatingParams, ServiceMeta>): Promise<RatingResponse> {
						return await this.updateRating(ctx.meta.user.id, ctx.params.recipeID, ctx.params.rating);
					},
				},
				/**
				 * Remove a rating from a recipe.
				 *
				 * @method
				 * @param {String} recipeID - The recipe id to remove the rating from
				 * @returns {RatingResponse}
				 */
				removeRating: {
					rest: {
						path: "/removeRating",
						method: "DELETE",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<RemoveRatingParams, ServiceMeta>): Promise<RatingResponse> {
						return await this.removeRating(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
				/**
				 * Get the rating of a user from a specific recipe.
				 *
				 * @method
				 * @param {String} recipeID
				 * @returns {Number}
				 */
				getRatingForUser: {
					rest: {
						path: "/getRatingForUser",
						method: "POST",
					},
					params: {
						recipeID: "string",
					},
					async handler(ctx: Context<GetRatingForUserParams, ServiceMeta>): Promise<number> {
						return await this.getRatingForUser(ctx.meta.user.id, ctx.params.recipeID);
					},
				},
			},
			events: {
				/**
				 * Event to handle the deletion of {@link RatingData} when a recipe is deleted.
				 *
				 * @event
				 */
				"recipe.deletion": {
					params: {
						recipeID: "string",
					},
					handler: async (ctx: Context<RecipeDeletionParams>) => {
						const id = (await this.getByRecipeID(ctx.params.recipeID) as RatingData).id;
						ctx.call("v1.rating.remove", { id });
					},
				},
			},
		}, schema));
	}

	public async getRatingForUser(userID: string, recipeID: string): Promise<number> {
		if (!userID) {throw new AuthError("Unauthorized! No user logged in.", 401);}
		const recipeRating = await this.getByRecipeID(recipeID);
		if (!recipeRating) {return 0;}
		const userRating = recipeRating.ratings.find(rating => rating.userID === userID);
		if (!userRating) {return 0;}
		return userRating.rating;
	}

	public async removeRating(userID: string, recipeID: string): Promise<RatingResponse> {
		const recipeRating = await this.getByRecipeID(recipeID);
		if (!recipeRating) {
			this.logger.warn(`Recipe[${recipeID}] has no ratings.`);
			return { success: false, method: RatingOperations.REMOVE, recipeID, userID, msg: "The recipe has no ratings yet" } as RatingResponse;
		}

		const index = this.getIndexOfRating(recipeRating, userID);
		if (index === -1) {
			this.logger.warn(`Recipe[${recipeID}] User(${userID}) tried to update non existent rating.`);
			return { success: false, method: RatingOperations.REMOVE, recipeID, userID, msg: `The user(${userID}) hasn't rated recipe so updating is not possible` } as RatingResponse;
		}

		this.logger.info(`Recipe[${recipeID}] removing rating from user (${userID})`);
		recipeRating.ratings.splice(index, 1);
		const newRecipeRating = this.calculateAvgRating(recipeRating);
		try {
			await this.broker.call("v1.rating.update", newRecipeRating);
			return { success: true, method: RatingOperations.REMOVE, recipeID, userID, msg: "Removed users rating from recipe" } as RatingResponse;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to update RatingData.", error.code || 500, this.name);
		}
	}

	public async addRating(userID: string, recipeID: string, rating: number): Promise<RatingResponse> {
		let recipeRating: RatingData = null;
		const existingRating = await this.getByRecipeID(recipeID);
		if (existingRating) {recipeRating = existingRating;}
		else {
			recipeRating = await this.createNewEntry(recipeID);
		}

		const index = this.getIndexOfRating(recipeRating, userID);
		if (index !== -1) {
			if (recipeRating.ratings[index].rating === rating) {return { success: false, method: RatingOperations.ADD, recipeID, userID, msg: "This rating is already present" } as RatingResponse;}

			this.logger.warn(`Recipe[${recipeID}] Rating add was called but user already rated. Triggering update`, recipeID, userID, rating);
			return await this.internalUpdateRating(recipeRating, index, rating, recipeID, userID);
		}

		const updatedRecipeRating = this.internalAddRating(recipeRating, userID, rating);
		try {
			await this.broker.call("v1.rating.update", updatedRecipeRating);
			return { success: true, method: RatingOperations.ADD, recipeID, userID, msg: "User rated recipe" } as RatingResponse;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to update RatingData.", error.code || 500, this.name);
		}
	}

	public async updateRating(userID: string, recipeID: string, rating: number): Promise<RatingResponse> {
		const recipeRating = await this.getByRecipeID(recipeID);
		if (!recipeRating) {
			this.logger.warn(`Recipe[${recipeID}] Has no rating yet.`);
			return { success: false, method: RatingOperations.UPDATE, recipeID, userID, msg: "The recipe has no ratings yet" } as RatingResponse;
		}

		const index = this.getIndexOfRating(recipeRating, userID);
		if (index === -1) {
			this.logger.warn(`Recipe[${recipeID}] User(${userID}) tried to update non existent rating.`);
			return { success: false, method: RatingOperations.UPDATE, recipeID, userID, msg: `The user(${userID}) hasn't rated recipe so updating is not possible` } as RatingResponse;
		}

		return await this.internalUpdateRating(recipeRating, index, rating, recipeID, userID);
	}

	private async internalUpdateRating(data: RatingData, index: number, rating: number, recipeID: string, userID: string): Promise<RatingResponse> {
		this.logger.info(`Recipe[${recipeID}] Updating rating for user (${userID})`);
		const updatedRating = this.replaceRating(data, index, rating);
		try {
			await this.broker.call("v1.rating.update", updatedRating);
			return { success: true, method: RatingOperations.UPDATE, recipeID, userID, msg: `Updated recipe new avgRating of: ${updatedRating.avgRating}` } as RatingResponse;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to update RatingData.", error.code || 500, this.name);
		}
	}

	private async createNewEntry(recipeID: string): Promise<RatingData> {
		this.logger.info(`Recipe[${recipeID}] Creating RatingData`);
		try {
			const data = await this.broker.call("v1.rating.create", { recipeID, ratings: new Array<RatingEntry>(), avgRating: null }) as RatingData;
			this.broker.emit("recipe.first_rating", { recipeID, ratingID: data.id });
			return data;
		} catch (error) {
			throw new DatabaseError(error.message || "Failed to create new RatingData.", error.code || 500, this.name);
		}
	}

	private replaceRating(data: RatingData, index: number, rating: number): RatingData {
		data.ratings[index].rating = rating;
		return this.calculateAvgRating(data);
	}

	private getIndexOfRating(data: RatingData, userID: string) {
		return data.ratings.findIndex((e: RatingEntry) => e.userID === userID);
	}

	private internalAddRating(data: RatingData, userID: string, rating: number): RatingData {
		this.logger.debug("Adding rating as RatingEntry", userID, rating, data.recipeID);
		data.ratings.push({ userID, rating } as RatingEntry);
		return this.calculateAvgRating(data);
	}

	private calculateAvgRating(data: RatingData): RatingData {
		const avgRating = data.ratings.reduce((prev, current) => prev + current.rating, 0) / data.ratings.length;
		this.logger.debug(`[${data.id}] new avg rating of: ${avgRating}`);
		data.avgRating = avgRating;
		return data;
	}

	private async getByRecipeID(recipeID: string): Promise<RatingData | null> {
		this.logger.info(`Trying to load RatingData for recipeID: ${recipeID}`);
		try {
			const possibleRating = (await this.broker.call("v1.rating.find", { query: { recipeID }}) as RatingData[])[0];
			if (possibleRating) {return possibleRating;}
			else {return null;}
		} catch (error) {
			throw new DatabaseError(error.message || "Error while fetching RatingData by ID.", error.code || 500, this.name);
		}
	}
}
