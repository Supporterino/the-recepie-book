import { Auth } from "../../types";

export interface PhotoUploadMeta {
	user: Auth;
	$multipart: { target: string; userID?: string; recipeID?: string };
	filename: string;
}
