"use strict";

import { randomBytes } from "crypto";
import { hash } from "bcrypt";
import {Context, Errors, Service, ServiceBroker} from "moleculer";
import Connection from "../../mixins/db.mixin";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import {  CompletePasswordReset, CompleteVerification, FRONTEND_URL, MAX_PAGE_SIZE, PAGE_SIZE, ServiceMeta, StartPasswordReset, UserData, VerificationData } from "../../shared";

export default class VerificationService extends Service {
	private DBConnection = new Connection("verifications").start();
	private SALT_ROUNDS: number = 10;

    // @ts-ignore
	public constructor(public broker: ServiceBroker, schema: ServiceSchema<{}> = {}) {
		super(broker);
		this.parseServiceSchema(Service.mergeSchemas({
			name: "verification",
            version: 1,
            mixins: [this.DBConnection, ErrorMixin],
			settings: {
				idField: "id",
				pageSize: PAGE_SIZE,
				maxPageSize: MAX_PAGE_SIZE,
				fields: [
					"id",
					"verified",
					"verificationStarted",
					"verificationToken",
					"passwordResetStarted",
					"passwordResetToken",
				],
				entityValidator: {
					verified: { type: "boolean" },
					verificationStarted: { type: "date", convert: true, optional: true },
					passwordResetStarted: { type: "date", convert: true, optional: true },
					verificationToken: { type: "string", optional: true },
					passwordResetToken: { type: "string", optional: true },
				},
			},
			actions: {
				startEmailVerification: {
					rest: {
						path: "/verifyEmail",
						method: "GET",
					},
					handler: (ctx: Context<null, ServiceMeta>) => this.startEmailVerification(ctx),
				},
				completeVerification: {
					rest: {
						path: "/completeVerification",
						method: "POST",
					},
					params: {
						userID: "string",
						token: "string",
					},
					handler: (ctx: Context<CompleteVerification, any>) => this.completeVerification(ctx),
				},
				startPasswordReset: {
					rest: {
						path: "/passwordReset",
						method: "POST",
					},
					params: {
						email: "string",
					},
					handler: (ctx: Context<StartPasswordReset>) => this.startPasswordReset(ctx),
				},
				completePasswordReset: {
					rest: {
						path: "/completePasswordReset",
						method: "POST",
					},
					params: {
						userID: "string",
						token: "string",
						newPassword: "string",
					},
					handler: (ctx: Context<CompletePasswordReset>) => this.completePasswordReset(ctx),
				},
			},
		}, schema));
	}

	public async completePasswordReset(ctx: Context<CompletePasswordReset>): Promise<void> {
		const [ userID, token, newPassword ] = [ ctx.params.userID, ctx.params.token, ctx.params.newPassword ];
		this.logger.info(`[Verification] Completing password reset for user: ${userID} with token: ${token}`);
		const user = await ctx.call("v1.user.get", { id: userID }) as UserData;
		const id = user.verificationID;
		if (!id) {throw new Errors.MoleculerError("User has no verification data.", 500);}
		this.logger.debug("[Verification] Loading verification data.");
		const data = await ctx.call("v1.verification.get", { id }) as VerificationData;
		if (!data) {throw new Errors.MoleculerError("Failed to fetch VerificationData", 500);}
		if (data.passwordResetToken !== token) {throw new Errors.MoleculerError("Tokens do not match.", 406);}
		this.logger.debug("[Verification] Setting new user password.");
		await ctx.call("v1.user.update", { id: userID, password: hash(newPassword, this.SALT_ROUNDS) });
		ctx.call("v1.verification.update", { id, passwordResetToken: null });
	}

	public async startPasswordReset(ctx: Context<StartPasswordReset>): Promise<void> {
		const email = ctx.params.email;
		this.logger.info(`[Verification] Starting password reset for email: ${email}`);
		this.logger.debug("[Verification] Getting user by email.");
		const user = await ctx.call("v1.user.getUserByEmail", { email }) as UserData;
		if (!user) {throw new Errors.MoleculerError("No account with this email found.", 404);}
		const id = user.verificationID;
		if (!id) {
			this.logger.warn("[Verification] User has no VerificationData.");
			throw new Errors.MoleculerError("User has no verification data. Please verify your email first.", 405);
		}
		const data = await ctx.call("v1.verification.get", { id }) as VerificationData;
		if (!data) {throw new Errors.MoleculerError("Failed to fetch VerificationData", 500);}
		if (!data.verified) {
			this.logger.warn("[Verification] User hans't verified its email yet");
			throw new Errors.MoleculerError("User's email isn't verified. Please verify your email first.", 405);
		}
		const token = this.genToken();
		this.logger.info("[Verification] Sending password reset link to user.");
		ctx.call("v1.mail.sendMail", {
			to: email,
			subject: "Password Reset",
			text: `Press this link to continue your password reset: ${FRONTEND_URL}passwordReset?id=${user.email}&token=${token}`,
		});
		ctx.call("v1.verification.update", { id, passwordResetStarted: new Date(), passwordResetToken: token });
	}

	public async completeVerification(ctx: Context<CompleteVerification, any>): Promise<void> {
		const [ id, token ] = [ ctx.params.userID, ctx.params.token ];
		this.logger.info(`[Verification] Completing email verification for VerificationData: ${id}`);
		const data = await ctx.call("v1.verification.get", { id }) as VerificationData;
		if (!data) {
			this.logger.warn("[Verification] No data for provided ID.");
			throw new Errors.MoleculerError("No matching verfication request found", 404);
		}
		if (data.verificationToken !== token) {
			this.logger.warn("[Verification] Tokens do not match!");
			throw new Errors.MoleculerError("Tokens do not match!", 406);
		}
		this.logger.debug("[Verification] Setting Data to verified.");
		ctx.call("v1.verification.update", { id, verified: true, verificationToken: null });
	}

	public async startEmailVerification(ctx: Context<null, ServiceMeta>): Promise<void> {
		let id = ctx.meta.user.verification;
		this.logger.info(`[Verification] Starting email verification for user id: ${id}`);
		if (!id) {id = await this.createNewVerificationData(ctx);}
		const data = await ctx.call("v1.verification.get", { id }) as VerificationData;
		let result: VerificationData;
		const token = this.genToken();
		this.logger.debug("[Verification] Setting token in VerificationData.");
		if (!data) {result = await ctx.call("v1.verification.update", { id, verificationStarted: new Date(), verificationToken: token }) as VerificationData;}
		else {
			if (data.verified) {throw new Errors.MoleculerError("User already verified", 406);}
			if (data.verificationToken) {throw new Errors.MoleculerError("Verification already in progress.", 403);}
			result = await ctx.call("v1.verification.update", { id, verificationStarted: new Date(), verificationToken: token }) as VerificationData;
		}
		this.logger.info("[Verification] Sending verfication mail to user");
		ctx.call("v1.mail.sendMail", {
			to: ctx.meta.user.email,
			subject: "E-Mail Verification",
			text: `Press this link to verify your email address: ${FRONTEND_URL}completeVerification?userID=${data.id}&token=${token}`,
		});
	}

	private async createNewVerificationData(ctx: Context<null, ServiceMeta>): Promise<string> {
		this.logger.info("[Verification] Creating new VerificationData payload.");
		const data = await ctx.call("v1.verification.create", { verified: false }) as VerificationData;
		ctx.emit("user.setVerificationData", { userID: ctx.meta.user.id, verficationID: data.id });
		return data.id;
	}

	private genToken(): string {
		return randomBytes(40).toString("hex");
	}
}
