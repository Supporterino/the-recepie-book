import { RecipeData } from "../interfaces";

export interface ConvertRecipeParams {
	recipe: RecipeData;
}

export interface ConvertRecipesParams {
	recipes: RecipeData[];
}

export interface ConvertTagsToIDParams {
	tagNames: string[];
}

export interface ConvertTagsToNameParams {
	tagIDs: string[];
}

export interface ConvertRatingIDtoRatingParams {
	ratingID: string;
}
