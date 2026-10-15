import path from 'path';

// Resolves a folder given by a client under the import root, and refuses anything that lands
// outside it: a `..` escape as much as a sibling whose name merely starts with the root's.
export function resolveInsideImportFolder(importFolderPath: string, folder_path: string): string {
    const resolvedRoot = path.resolve(importFolderPath);
    const resolvedPath = path.resolve(resolvedRoot, folder_path);
    if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(resolvedRoot + path.sep)) {
        throw new Error("Invalid folder path");
    }
    return resolvedPath;
}
