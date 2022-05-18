import { Context, Service, ServiceBroker} from "moleculer";
import { SendMail } from "../../shared";

declare class MailService extends Service {
	public constructor(broker: ServiceBroker)

	/**
	 * Send a mail to a user with the no-reply@supporterino.de mail address.
	 * @param {string} to
	 * @param {string} subject
	 * @param {string} text
	 */
	public sendMail(ctx: Context<SendMail>)
}
