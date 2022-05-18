export interface VerificationData {
	id: string;
	verified: boolean;
	verificationStarted: Date;
	verificationSuccess: Date;
	passwordResetStarted: Date;
	passwordResetInProgress: boolean;
	verificationToken: string;
	passwordResetToken: string;
}
