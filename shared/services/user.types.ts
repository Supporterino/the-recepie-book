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

export interface UserAvatarUpdateParams {
	userID: string;
	imageName: string;
}
