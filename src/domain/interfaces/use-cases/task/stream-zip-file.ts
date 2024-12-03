import { Response } from "express";
import { UserUpdateModel } from "../../../entities/user";
export interface StreamZipFileUseCase {
    execute(current_user: UserUpdateModel, task_id: number, res: Response): Promise<void>;
}