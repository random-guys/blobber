import { resolve as resolvePath, basename } from 'path';
import storage, { BlobService, date } from 'azure-storage';
import { AsyncParser } from 'json2csv';
import { createWriteStream, createReadStream } from 'fs';
import { Transform } from 'stream';
import { Options } from './typings';
import Omi, { OmiEvent } from '@random-guys/omi';
import { differenceInCalendarDays } from 'date-fns';

/**
 * Thin wrapper around azure storage for uploading files to blob storage.
 * Expects `process.env.AZURE_STORAGE_CONNECTION_STRING` to be set
 */
export default class Blobber<T> {
  private omi: Omi<T>;
  private containerName: string;
  private blobService: BlobService;
  private regex: RegExp;

  /**
   * Creates a new Blobber instance
   * @param containerName the name of the container
   */
  constructor(containerName: string) {
    this.omi = new Omi<T>([]);
    this.containerName = containerName;
    this.blobService = storage.createBlobService();
    this.regex = /(\d{1,4}([.\-/])\d{1,2}([.\-/])\d{1,4})/g
  }

  /**
   * Retrieves the URL of a file given the file name
   * @param blobName the name of the blob
   * @returns the URL of the blob
   */
  private getFileUrl(blobName: string) {
    return this.blobService.getUrl(this.containerName, blobName);
  }

  /**
   * Deletes a single blob and awaits the response
   * @param blob - individual blob to be deleted
   */
  private deleteBlob(blob: BlobService.BlobResult) {
    return new Promise((resolve, reject) => {
      return this.blobService.deleteBlob(this.containerName, blob.name, (err, response) => {
        if (err) reject(err);
        resolve(response);
      })
    })
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

  /**
   * Deletes blobs older than 30 days
   */
  async deleteOldBlobs() {
    return new Promise((resolve, reject) => {
      this.blobService.listBlobsSegmented(this.containerName, null, (err, result) => {
        if (err) return reject(err);
        const promises = [];
        if (result) {
          result.entries.forEach(blob => {
            const blobDate = blob.name.match(this.regex)[0];
            if (differenceInCalendarDays(new Date(), new Date(blobDate)) >= 30) {
              promises.push(this.deleteBlob(blob))
            }
          });
          Promise.all(promises).then((_response) => {
            resolve(`Finished deleting ${promises.length} old blobs`);
          });
        }
      })
    })
  }
}
