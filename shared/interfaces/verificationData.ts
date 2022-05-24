export interface VerificationData {
	id: string;
	verified: boolean;
	verificationStarted: Date;
	passwordResetStarted: Date;
	verificationToken: string;
	passwordResetToken: string;
}
