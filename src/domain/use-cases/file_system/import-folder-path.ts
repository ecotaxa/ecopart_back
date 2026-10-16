import path from 'path';
import { isInsideFolder } from '../../utils/path-containment';

// Resolves a folder given by a client under the import root, and refuses anything that lands
// outside it: a `..` escape, an absolute path, or a sibling whose name merely starts with the root's.
export function resolveInsideImportFolder(importFolderPath: string, folder_path: string): string {
    const resolvedPath = path.resolve(importFolderPath, folder_path);
    if (!isInsideFolder(importFolderPath, resolvedPath)) throw new Error("Invalid folder path");
    return resolvedPath;
}
