import { RecipeData } from "../interfaces";

export interface ConvertRecipe {
	recipe: RecipeData;
}

export interface ConvertRecipes {
	recipes: RecipeData[];
}

export interface ConvertTagsToID {
	tagNames: string[];
}

export interface ConvertTagsToName {
	tagIDs: string[];
}

export interface ConvertRatingIDtoRating {
	ratingID: string;
}
