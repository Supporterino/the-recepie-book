export interface GetFavoriteParams {
	userID: string;
}

export interface AddFavoriteParams {
	recipeID: string;
}

export interface RemoveFavoriteParams {
	recipeID: string;
}

export interface IsFavoriteParams {
	recipeID: string;
}