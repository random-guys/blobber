# Blobber 🍅

GoMoney records as Azure blobs.

# Installation

```sh
yarn add @random-guys/blobber
```

or

```sh
npm install @random-guys/blobber
```

## Usage

```ts
const stream = async () => {
  try {
    const blobber = new Blobber<Number>('exports');

    // 
    const uppercaseTransformer = new Transform({
      writableObjectMode: true,
      readableObjectMode: true,
      transform(chunk, encoding, callback) {
        this.push({ Name: chunk });
        callback();
      }
    });

    const blobPath = join(__dirname, '../../test.csv');
    const options: OmiOptions<string> = {
      transformer: uppercaseTransformer,
      fields: ['Name'],
      blobPath
    };

    const printDownloadUrl = (val: string) => {
      console.log(val);
    };
    blobber.createBlobFromOmi(options, printDownloadUrl);

    // add the records to the file
    blobber.addRecords([...Array.from({ length: 5 }).keys()].map(i => i));

    // null tell the stream we're done adding records
    blobber.addRecords([null]);
  } catch (error) {
    console.log(error);
  }
};

stream();
```
