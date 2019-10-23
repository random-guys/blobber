import Omi from '@random-guys/omi';
import { Transform } from 'stream';

/**
 * @param omi the records to be written to the report.
 * @param fields the column titles.
 * @param blobPath the full path of the uploaded file.
 * @param transformer an optional transformer
 */
export interface OmiOptions<T> {
  fields: string[];
  blobPath: string;
  transformer?: Transform;
}