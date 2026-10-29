import path from "path";
import * as fsPromises from "fs/promises";

import { ProjectResponseModel } from "../../entities/project";
import { PublicSampleModel } from "../../entities/sample";
import { TaskLogger } from "../../interfaces/repositories/task-repository";

const BYTE_UNITS = ["B", "kB", "MB", "GB", "TB"];
// The application root, which the data storage folders are configured relative to.
const BASE_FOLDER = path.join(__dirname, "..", "..", "..", "..");

// Task logs are readable by the task owner: they show paths relative to the application root, never the server layout.
export function relativePath(absolute_path: string): string {
    return path.relative(BASE_FOLDER, absolute_path);
}

// A byte count as the task log shows it ("12.3 MB"), in powers of 1000.
export function formatBytes(bytes: number): string {
    let value = bytes;
    let unit = 0;
    while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
        value /= 1000;
        unit += 1;
    }
    return unit === 0 ? `${value} ${BYTE_UNITS[0]}` : `${value.toFixed(1)} ${BYTE_UNITS[unit]}`;
}

// Size of a written file, null when it cannot be read: a log line never fails an export.
export async function fileSize(file_path: string): Promise<number | null> {
    try {
        return (await fsPromises.stat(file_path)).size;
    } catch {
        return null;
    }
}

export async function fileSizeLabel(file_path: string): Promise<string> {
    const size = await fileSize(file_path);
    return size === null ? "size unknown" : formatBytes(size);
}

// One line per exported project, in the order of the samples.
export async function logExportedProjects(log: TaskLogger, samples: PublicSampleModel[], projects_by_id: Map<number, ProjectResponseModel>): Promise<void> {
    const count_by_project = new Map<number, number>();
    for (const sample of samples) count_by_project.set(sample.project_id, (count_by_project.get(sample.project_id) ?? 0) + 1);
    for (const [project_id, count] of count_by_project) {
        const project = projects_by_id.get(project_id);
        if (!project) continue;
        await log(`Request: project ${project_id} '${project.project_title}' (${project.instrument_model}): ${count} sample(s)`);
    }
}
