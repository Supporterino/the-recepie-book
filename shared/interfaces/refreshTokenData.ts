export interface RefreshTokenData {
	id: string;
	user: string;
	token: string;
	expires: Date;
	created: Date;
	revoked?: Date;
	replacedByToken?: string;
}
