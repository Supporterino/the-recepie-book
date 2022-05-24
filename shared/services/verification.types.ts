export interface CompleteVerification {
	userID: string;
	token: string;
}

export interface StartPasswordReset {
	email: string;
}

export interface CompletePasswordReset {
	userID: string;
	token: string;
	newPassword: string;
}

export interface RegistrationTrigger {
	userID: string;
	email: string;
}
