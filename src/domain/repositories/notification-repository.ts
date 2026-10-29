import { NotificationDataSource } from "../../data/interfaces/data-sources/notification-data-source";
import { ProjectDataSource } from "../../data/interfaces/data-sources/project-data-source";
import { NotificationRepository } from "../interfaces/repositories/notification-repository";
import { NotificationResponseModel, NotificationSearchModel, NotificationType } from "../entities/notification";
import { SearchResult } from "../entities/search";
import { TaskResponseModel, TasksStatus, TaskType } from "../entities/task";

const TASK_LABELS: { [key in TaskType]: string } = {
    [TaskType.Export]: "Binned export",
    [TaskType.Import]: "Sample import",
    [TaskType.Import_Backup]: "Project backup",
    [TaskType.Export_Backup]: "Backup export",
    [TaskType.Import_CTD]: "CTD import",
    [TaskType.Import_EcoTaxa]: "EcoTaxa import",
    [TaskType.Export_Raw]: "Raw export",
    [TaskType.Regenerate_Pivot]: "Pivot regeneration",
    [TaskType.Compute_Particle_Stats]: "Particle statistics computation",
    [TaskType.Delete_Sample]: "Sample deletion",
    [TaskType.Delete_Project]: "Project deletion",
};

const END_OUTCOMES: { [status: string]: { type: NotificationType, text: string } } = {
    [TasksStatus.Done]: { type: NotificationType.TaskDone, text: "is finished" },
    [TasksStatus.Error]: { type: NotificationType.TaskError, text: "failed" },
    [TasksStatus.Cancelled]: { type: NotificationType.TaskCancelled, text: "was cancelled" },
};

export class NotificationRepositoryImpl implements NotificationRepository {
    notificationDataSource: NotificationDataSource;
    projectDataSource: ProjectDataSource;

    constructor(notificationDataSource: NotificationDataSource, projectDataSource: ProjectDataSource) {
        this.notificationDataSource = notificationDataSource;
        this.projectDataSource = projectDataSource;
    }

    // Notifies the owner of a task that it ended, e.g. "Sample import #12 on project "Alpha" is finished".
    async onTaskEnded(task: TaskResponseModel, status: TasksStatus): Promise<void> {
        const outcome = END_OUTCOMES[status];
        if (!outcome) return;

        const label = TASK_LABELS[task.task_type as TaskType] ?? `Task`;
        let message = `${label} #${task.task_id}`;
        if (task.task_project_id) {
            const project = await this.projectDataSource.getOne({ project_id: task.task_project_id });
            if (project) message += ` on project "${project.project_title}"`;
        }
        message += ` ${outcome.text}.`;

        await this.notificationDataSource.create({
            user_id: task.task_owner_id,
            notification_type: outcome.type,
            notification_message: message,
            task_id: task.task_id,
            project_id: task.task_project_id ?? null,
            notification_creation_utc_date_time: new Date().toISOString(),
        });
    }

    getNotification(notification_id: number): Promise<NotificationResponseModel | null> {
        return this.notificationDataSource.getOne(notification_id);
    }

    getNotifications(search: NotificationSearchModel): Promise<SearchResult<NotificationResponseModel>> {
        return this.notificationDataSource.getAll(search);
    }

    countUnread(user_id: number): Promise<number> {
        return this.notificationDataSource.countUnread(user_id);
    }

    async markRead(user_id: number, notification_id: number): Promise<void> {
        await this.notificationDataSource.markRead(user_id, notification_id);
    }

    markAllRead(user_id: number): Promise<number> {
        return this.notificationDataSource.markRead(user_id);
    }

    deleteNotification(user_id: number, notification_id: number): Promise<number> {
        return this.notificationDataSource.deleteOne(user_id, notification_id);
    }
}
