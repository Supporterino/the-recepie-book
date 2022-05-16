"use strict";

import { Context, Service, ServiceBroker} from "moleculer";
import { createTransport } from "nodemailer";
import { ErrorMixin } from "../../mixins/error_logging.mixin";
import { SendMail } from "../../shared";

export default class MailService extends Service {
	private transporter = createTransport({
		host: "smtp.strato.de",
		port: 587,
		secure: true,
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASS,
		},
	});

	public constructor(public broker: ServiceBroker) {
		super(broker);
		this.parseServiceSchema({
			name: "mail",
            version: 1,
			mixins: [ErrorMixin],
			actions:{
				sendMail: {
					params: {
						to: "string",
						subject: "string",
						text: "string",
					},
					handler: (ctx: Context<SendMail>): void => this.sendMail(ctx),
				},
			},
		});
	}

	public sendMail(ctx: Context<SendMail>) {
		this.transporter.sendMail({
			from: '"The recepie book" <no-reply@supporterino.de>',
			to: ctx.params.to,
			subject: ctx.params.subject,
			text: ctx.params.text,
		});
	}
}
