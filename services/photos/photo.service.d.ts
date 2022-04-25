import { Context, Service, ServiceBroker } from "moleculer";
import { Transform } from "stream";
import { PhotoUploadMeta } from "../../shared";

declare class PhotoService extends Service {
	public constructor(broker: ServiceBroker);

	/**
	 * Triggers the download of a image by its filename. The image is transported as a byte stream
	 * @param fileName the name of the file to download
	 */
	public getImage(fileName: string);

	/**
	 * Triggers the deletion of the metadata and blob data of a image via its name
	 * @param name - The name of the file
	 */
	public deleteImage(name: string): void;

	/**
	 * Receive a image via an http post request with a {@link FormData} object attached. The image is save to a GridFSBucket and an event is triggered to bind the image to the corresponding object.
	 * @param ctx
	 */
	public saveImage(
		ctx: Context<Transform, PhotoUploadMeta>
	): PromiseLike<string>;
}

export = PhotoService;
