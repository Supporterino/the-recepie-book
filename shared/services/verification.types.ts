export interface CompleteVerification {
	a: string;
	b: string;
}

export interface StartPasswordReset {
	email: string;
}

export interface CompletePasswordReset {
	userID: string;
	token: string;
	newPassword: string;
}
