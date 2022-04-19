export interface Authenticate {
	email: string;
	password: string;
}

export interface RefreshToken {
	token: string;
}

export interface RevokeToken {
	token: string;
}
