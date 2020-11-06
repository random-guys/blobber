import { resolve as resolvePath, basename } from 'path';
import storage, { BlobService, date } from 'azure-storage';
import { AsyncParser } from 'json2csv';
import { createWriteStream, createReadStream } from 'fs';
import { Transform } from 'stream';
import { Options } from './typings';
import Omi, { OmiEvent } from '@random-guys/omi';

/**
 * Thin wrapper around azure storage for uploading files to blob storage.
 * Expects `process.env.AZURE_STORAGE_CONNECTION_STRING` to be set
 */
export default class Blobber<T> {
  private omi: Omi<T>;
  private containerName: string;
  private blobService: BlobService;

  /**
   * Creates a new Blobber instance
   * @param containerName the name of the container
   */
  constructor(containerName: string) {
    this.omi = new Omi<T>([]);
    this.containerName = containerName;
    this.blobService = storage.createBlobService();
  }

  /**
   * Retrieves the URL of a file given the file name
   * @param blobName the name of the blob
   * @returns the URL of the blob
   */
  private getFileUrl(blobName: string) {
    return this.blobService.getUrl(this.containerName, blobName);
  }

  addRecord(record: T) {
    this.omi.addOne(record);
  }

  addRecords(records: T[]) {
    this.omi.addMany(records);
  }

  /**
   * Creates a CSV file from a stream of records
   * @param fields the column headers
   * @param callback the callback that returns the URL when the upload is complete
   * @param pathLike the absolute path for the file
   */
  createBlobFromOmi(options: Options, callback: (val: string) => void) {
    const asyncParser = new AsyncParser(
      { fields: options.fields, header: true },
      {
        writableObjectMode: true,
        readableObjectMode: true
      }
    );

    const fileStream = createWriteStream(options.localFilePath);

    this.omi.on(OmiEvent.END, async () => {
      // stream the file to blob storage.
      callback(
        await this.streamLocalFile(
          options.remoteFilePath,
          createReadStream(options.localFilePath)
        )
      );
    });

    // default transform that doesn nothing
    const defaultTransform = new Transform({
      writableObjectMode: true,
      readableObjectMode: true,
      transform(chunk, _encoding, callback) {
        this.push(chunk);
        callback();
      }
    });

    const transform = options.transformer
      ? options.transformer
      : defaultTransform;

    this.omi.pipe(transform).pipe(asyncParser.processor).pipe(fileStream);
  }

  /**
   * Enumerates the contents of a Azure blob storage account.
   * @returns a list of containers
   */
  async getStorageContainers() {
    return new Promise<BlobService.ContainerResult[]>((resolve, reject) => {
      this.blobService.listContainersSegmented(null, (err, data) => {
        if (err) return reject(err);
        return resolve(data.entries);
      });
    });
  }

  /**
   * Streams the contents of a file from the filesystem
   * @param filePath path to the file to be uploaded
   * @returns the file url
   */
  async streamLocalFile(blobName: string, stream: any) {
    return new Promise<string>((resolve, reject) => {
      stream.pipe(
        this.blobService.createWriteStreamToBlockBlob(
          this.containerName,
          blobName
        )
      );

      stream.on('error', (error: any) => {
        reject(error);
      });

      stream.on('end', () => {
        resolve(this.getFileUrl(blobName));
      });
    });
  }

  /**
   * Uploads a file from the filesystem
   * @param filePath path to the file to be uploaded
   * @returns the file url
   */
  async uploadLocalFile(filePath: string) {
    return new Promise<string>((resolve, reject) => {
      const fullPath = resolvePath(filePath);
      const blobName = basename(filePath);

      this.blobService.createBlockBlobFromLocalFile(
        this.containerName,
        blobName,
        fullPath,
        (err) => {
          if (err) return reject(err);
          return resolve(this.getFileUrl(blobName));
        }
      );
    });
  }
}
