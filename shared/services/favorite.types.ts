export interface GetFavorite {
	userID: string;
}

export interface AddFavorite {
	recipeID: string;
}

export interface RemoveFavorite {
	recipeID: string;
}

export interface IsFavorite {
	recipeID: string;
}
