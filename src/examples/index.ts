import { join } from 'path';
import { Transform } from 'stream';
import { config } from 'dotenv';
config();

import { Blobber, Options } from '../blobber';

const stream = async () => {
  try {
    const blobber = new Blobber<Number>('test');

    const uppercaseTransformer = new Transform({
      writableObjectMode: true,
      readableObjectMode: true,
      transform(chunk, _encoding, callback) {
        this.push({ Name: chunk });
        callback();
      }
    });

    const blobPath = join(__dirname, '../../test.csv');

    blobber.addRecords([...Array.from({ length: 5 }).keys()].map((i) => i));

    const options: Options = {
      transformer: uppercaseTransformer,
      useFullName: true,
      fields: ['Name'],
      blobPath
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
