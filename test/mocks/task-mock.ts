import { MiddlewareAuth } from "../../src/presentation/interfaces/middleware/auth";

import { Request, Response, NextFunction } from "express";
import { TaskRepository } from "../../src/domain/interfaces/repositories/task-repository";
import { SearchInfo, SearchResult } from "../../src/domain/entities/search";
import { TaskResponseModel, TaskTypeResponseModel, TaskStatusResponseModel } from "../../src/domain/entities/task";
import { DeleteTaskUseCase } from "../../src/domain/interfaces/use-cases/task/delete-task";
import { GetOneTaskUseCase } from "../../src/domain/interfaces/use-cases/task/get-one-task";
import { SearchTasksUseCase } from "../../src/domain/interfaces/use-cases/task/search-task";
import { StreamZipFileUseCase } from "../../src/domain/interfaces/use-cases/task/stream-zip-file";
import { GetLogFileTaskUseCase } from "../../src/domain/interfaces/use-cases/task/get-log-file-task";

export class MockTaskRepository implements TaskRepository {
    getOneTask(): Promise<TaskResponseModel | null> {
        throw new Error("Method not implemented for getOneTask");
    }
    startTask(): Promise<void> {
        throw new Error("Method not implemented for startTask");
    }
    finishTask(): Promise<void> {
        throw new Error("Method not implemented for finishTask");
    }
    updateTaskProgress(): Promise<void> {
        throw new Error("Method not implemented for updateTaskProgress");
    }
    createTask(): Promise<number> {
        throw new Error("Method not implemented for createTask");
    }
    getTask(): Promise<TaskResponseModel | null> {
        throw new Error("Method not implemented for getTask");
    }
    deleteTask(): Promise<number> {
        throw new Error("Method not implemented for deleteTask");
    }
    standardGetTasks(): Promise<SearchResult<TaskResponseModel>> {
        throw new Error("Method not implemented for standardGetTasks");
    }
    standardGetTaskType(): Promise<SearchResult<TaskTypeResponseModel>> {
        throw new Error("Method not implemented for standardGetTaskType");
    }
    standardGetTaskStatus(): Promise<SearchResult<TaskStatusResponseModel>> {
        throw new Error("Method not implemented.");
    }
    getTasksByUser(): Promise<number[]> {
        throw new Error("Method not implemented for getTasksByUser");
    }
    getLogFileTask(): Promise<string> {
        throw new Error("Method not implemented for getLogFileTask");
    }
    getZipFilePath(): Promise<string> {
        throw new Error("Method not implemented for getZipFilePath");
    }
    failedTask(): Promise<void> {
        throw new Error("Method not implemented for failedTask");
    }
    logMessage(): Promise<void> {
        throw new Error("Method not implemented for logMessage");
    }
    updateTaskResult(): Promise<void> {
        throw new Error("Method not implemented for updateTaskResult");
    }
}

export class MockMiddlewareAuth implements MiddlewareAuth {
    auth(_: Request, __: Response, next: NextFunction): void {
        next()
    }
    auth_refresh(): void {
        throw new Error("Method not implemented for auth_refresh");
    }
}
export class MockDeleteTaskUseCase implements DeleteTaskUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for DeleteTaskUseCase");
    }
}
export class MockGetOneTaskUseCase implements GetOneTaskUseCase {
    execute(): Promise<TaskResponseModel> {
        throw new Error("Method not implemented for GetOneTaskUseCase");
    }
}
export class MockGetLogFileTask implements GetLogFileTaskUseCase {
    execute(): Promise<string> {
        throw new Error("Method not implemented for GetLogFileTask");
    }
}
export class MockStreamZipFileUseCase implements StreamZipFileUseCase {
    execute(): Promise<void> {
        throw new Error("Method not implemented for StreamZipFileUseCase");
    }
}
export class MockSearchTasksUseCase implements SearchTasksUseCase {
    execute(): Promise<{ tasks: TaskResponseModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented for SearchTasksUseCase");
    }
}

export class MockGetLogFileTaskUseCase implements GetLogFileTaskUseCase {
    execute(): Promise<string> {
        throw new Error("Method not implemented for MockGetLogFileTaskUseCase");
    }
}

export class MockSearchTaskUseCase implements SearchTasksUseCase {
    execute(): Promise<{ tasks: TaskResponseModel[], search_info: SearchInfo }> {
        throw new Error("Method not implemented for MockSearchTaskUseCase");
    }
}
