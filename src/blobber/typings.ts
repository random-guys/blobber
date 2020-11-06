import Omi from '@random-guys/omi';
import { Transform } from 'stream';

/**
 * @param fields the column titles.
 * @param localFilePath the full local path of the uploaded file.
 * @param remoteFilePath the relative path of the file when uploaded.
 * @param transformer an optional transformer
 */
export interface Options {
  fields: string[];
  localFilePath: string;
  remoteFilePath: string;
  transformer?: Transform;
}
