import path from 'path';

// True when target, once resolved, is root itself or somewhere below it. A plain startsWith on the
// resolved strings is not enough: it also accepts a sibling such as "<root>_old".
export function isInsideFolder(root: string, target: string): boolean {
    const resolvedRoot = path.resolve(root);
    const resolvedTarget = path.resolve(target);
    return resolvedTarget === resolvedRoot || resolvedTarget.startsWith(resolvedRoot + path.sep);
}
