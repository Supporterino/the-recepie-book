export interface IsLegitUserParams {
	userID: string;
	email: string;
}

export interface OwnsRecipeParams {
	recipeID: string;
}

export interface GetSanitizedUserParams {
	userID: string;
}
