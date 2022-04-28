import { Role } from "../../types";

export interface IsLegitUser {
	userID: string;
	email: string;
}

export interface OwnsRecipe {
	recipeID: string;
}

export interface GetSanitizedUser {
	userID: string;
}

export interface UserAvatarUpdate {
	userID: string;
	imageName: string;
}

export interface Rename {
	username: string;
}

export interface SetUserRole {
	userID: string;
	role: Role;
}
