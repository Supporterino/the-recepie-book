import { User } from "../../types";

export interface LoginServiceResponse {
	user: User;
	jwtToken: "string";
	refreshToken: "string";
}
