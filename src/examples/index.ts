import { join } from 'path';
import { Transform } from 'stream';
import { config } from 'dotenv';
config();

import { Blobber, Options } from '../blobber';

const stream = async () => {
  try {
    const blobber = new Blobber<Number>('test');

    const transformer = new Transform({
      writableObjectMode: true,
      readableObjectMode: true,
      transform(chunk, _encoding, callback) {
        this.push({ Name: chunk });
        callback();
      }
    });

    const localFilePath = join(__dirname, '../../test.csv');
    const remoteFilePath = 'temp/test.csv';

    blobber.addRecords([...Array.from({ length: 5 }).keys()].map((i) => i));

    const options: Options = {
      fields: ['Name'],
      remoteFilePath,
      localFilePath,
      transformer
    };

    const printUrl = (val: string) => {
      console.log(val);
    };
    blobber.createBlobFromOmi(options, printUrl);

    blobber.addRecords([...Array.from({ length: 5 }).keys()].map((i) => i));
    blobber.addRecords([...Array.from({ length: 5 }).keys()].map((i) => i));
    blobber.addRecords([null]);
  } catch (error) {
    console.log(error);
  }
};

stream();
