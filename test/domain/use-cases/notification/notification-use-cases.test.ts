import { UserUpdateModel } from "../../../../src/domain/entities/user";
import { NotificationResponseModel, NotificationType } from "../../../../src/domain/entities/notification";
import { UserRepository } from "../../../../src/domain/interfaces/repositories/user-repository";
import { NotificationRepository } from "../../../../src/domain/interfaces/repositories/notification-repository";
import { GetNotifications } from "../../../../src/domain/use-cases/notification/get-notifications";
import { CountUnreadNotifications } from "../../../../src/domain/use-cases/notification/count-unread-notifications";
import { MarkNotificationRead } from "../../../../src/domain/use-cases/notification/mark-notification-read";
import { MarkAllNotificationsRead } from "../../../../src/domain/use-cases/notification/mark-all-notifications-read";
import { DeleteNotification } from "../../../../src/domain/use-cases/notification/delete-notification";
import { MockUserRepository } from "../../../mocks/user-mock";
import { MockNotificationRepository } from "../../../mocks/notification-mock";

describe("Notification use cases", () => {
    let mockUserRepository: UserRepository;
    let mockNotificationRepository: NotificationRepository;

    const user: UserUpdateModel = { user_id: 1 };
    const notification: NotificationResponseModel = {
        notification_id: 5,
        user_id: 1,
        notification_type: NotificationType.TaskDone,
        notification_message: "Sample import #12 on project \"Alpha\" is finished.",
        task_id: 12,
        project_id: 3,
        is_read: false,
        notification_creation_utc_date_time: "2026-10-26T10:00:00.000Z",
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUserRepository = new MockUserRepository();
        mockNotificationRepository = new MockNotificationRepository();
    });

    describe("GetNotifications", () => {
        test("throws when the account cannot be used, without reading notifications", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockRejectedValue(new Error("User cannot be used"));
            const getSpy = jest.spyOn(mockNotificationRepository, "getNotifications");

            await expect(new GetNotifications(mockUserRepository, mockNotificationRepository).execute(user, { unread_only: false, page: 1, limit: 10 }))
                .rejects.toStrictEqual(new Error("User cannot be used"));
            expect(getSpy).toBeCalledTimes(0);
        });

        test("returns the page of the logged user with the unread count", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            const getSpy = jest.spyOn(mockNotificationRepository, "getNotifications").mockResolvedValue({ items: [notification], total: 11 });
            jest.spyOn(mockNotificationRepository, "countUnread").mockResolvedValue(4);

            const result = await new GetNotifications(mockUserRepository, mockNotificationRepository).execute(user, { unread_only: true, page: 2, limit: 10 });

            expect(getSpy).toBeCalledWith({ user_id: 1, unread_only: true, page: 2, limit: 10 });
            expect(result).toEqual({
                notifications: [notification],
                search_info: { total: 11, limit: 10, total_on_page: 1, page: 2, pages: 2 },
                unread_count: 4,
            });
        });
    });

    test("CountUnreadNotifications counts the logged user's unread notifications", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        const countSpy = jest.spyOn(mockNotificationRepository, "countUnread").mockResolvedValue(3);

        await expect(new CountUnreadNotifications(mockUserRepository, mockNotificationRepository).execute(user)).resolves.toBe(3);
        expect(countSpy).toBeCalledWith(1);
    });

    describe("MarkNotificationRead", () => {
        test("marks a notification of the logged user", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockNotificationRepository, "getNotification").mockResolvedValue(notification);
            const markSpy = jest.spyOn(mockNotificationRepository, "markRead").mockResolvedValue();

            await new MarkNotificationRead(mockUserRepository, mockNotificationRepository).execute(user, 5);
            expect(markSpy).toBeCalledWith(1, 5);
        });

        test("reports the notification of another user as not found", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockNotificationRepository, "getNotification").mockResolvedValue({ ...notification, user_id: 2 });
            const markSpy = jest.spyOn(mockNotificationRepository, "markRead");

            await expect(new MarkNotificationRead(mockUserRepository, mockNotificationRepository).execute(user, 5))
                .rejects.toStrictEqual(new Error("Notification not found"));
            expect(markSpy).toBeCalledTimes(0);
        });

        test("reports a missing notification as not found", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockNotificationRepository, "getNotification").mockResolvedValue(null);

            await expect(new MarkNotificationRead(mockUserRepository, mockNotificationRepository).execute(user, 5))
                .rejects.toStrictEqual(new Error("Notification not found"));
        });
    });

    test("MarkAllNotificationsRead marks every notification of the logged user", async () => {
        jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
        const markSpy = jest.spyOn(mockNotificationRepository, "markAllRead").mockResolvedValue(2);

        await expect(new MarkAllNotificationsRead(mockUserRepository, mockNotificationRepository).execute(user)).resolves.toBe(2);
        expect(markSpy).toBeCalledWith(1);
    });

    describe("DeleteNotification", () => {
        test("deletes a notification of the logged user", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            const deleteSpy = jest.spyOn(mockNotificationRepository, "deleteNotification").mockResolvedValue(1);

            await new DeleteNotification(mockUserRepository, mockNotificationRepository).execute(user, 5);
            expect(deleteSpy).toBeCalledWith(1, 5);
        });

        test("reports a notification it could not delete as not found", async () => {
            jest.spyOn(mockUserRepository, "ensureUserCanBeUsed").mockResolvedValue();
            jest.spyOn(mockNotificationRepository, "deleteNotification").mockResolvedValue(0);

            await expect(new DeleteNotification(mockUserRepository, mockNotificationRepository).execute(user, 5))
                .rejects.toStrictEqual(new Error("Notification not found"));
        });
    });
});
