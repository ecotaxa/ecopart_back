import { SearchInfo } from "../../src/domain/entities/search";
import { PrivateTaskRequestCreationModel, TaskResponseModel } from "../../src/domain/entities/task";

export const TaskResponseModel_1: TaskResponseModel = {
    task_type_id: 4,
    task_type: "IMPORT",
    task_status_id: 5,
    task_status: "DONE",
    task_owner_id: 1,
    task_owner: "undefined undefined (julie.coustenoble@imev-mer.fr)",
    task_project_id: 5,
    task_log_file_path: "/Users/jcoustenoble/Documents/GitHub/ecopart_back/data_storage/tasks_log/task_1.log",
    task_progress_pct: 100,
    task_progress_msg: "Task is done sucessfilly",
    task_params: { "samples": ["perle3_003"] },
    task_result: "",
    task_error: "",
    task_question: "",
    task_reply: "",
    task_step: "0",
    task_id: 1,
    task_creation_date: "2024-11-20 16:35:09",
    task_start_date: "",
    task_end_date: ""
}
export const TaskResponseModel_2: TaskResponseModel = {
    task_type_id: 4,
    task_type: "IMPORT",
    task_status_id: 6,
    task_status: "ERROR",
    task_owner_id: 1,
    task_owner: "undefined undefined (julie.coustenoble@imev-mer.fr)",
    task_project_id: 5,
    task_log_file_path: "/Users/jcoustenoble/Documents/GitHub/ecopart_back/data_storage/tasks_log/task_2.log",
    task_progress_pct: 10,
    task_progress_msg: "Step 1/4 sample validation : start",
    task_params: { "samples": ["Mooring_0N_23W_201910_850m"] },
    task_result: "",
    task_error: "Samples not importable: Mooring_0N_23W_201910_850m",
    task_question: "",
    task_reply: "",
    task_step: "0",
    task_id: 2,
    task_creation_date: "2024-11-20 16:40:30",
    task_start_date: "",
    task_end_date: ""
}

export const TaskResponseModel_3: TaskResponseModel = {
    task_type_id: 4,
    task_type: "IMPORT",
    task_status_id: 5,
    task_status: "DONE",
    task_owner_id: 1,
    task_owner: "undefined undefined (julie.coustenoble@imev-mer.fr)",
    task_project_id: 6,
    task_log_file_path: "/Users/jcoustenoble/Documents/GitHub/ecopart_back/data_storage/tasks_log/task_3.log",
    task_progress_pct: 100,
    task_progress_msg: "Task is done sucessfilly",
    task_params: { "samples": ["Mooring_0N_23W_201910_850m"] },
    task_result: "",
    task_error: "",
    task_question: "",
    task_reply: "",
    task_step: "0",
    task_id: 3,
    task_creation_date: "2024-11-20 16:40:37",
    task_start_date: "",
    task_end_date: ""
}
export const SearchTasksResult: {
    tasks: TaskResponseModel[];
    search_info: SearchInfo
} = {
    tasks: [
        TaskResponseModel_1,
        TaskResponseModel_2,
        TaskResponseModel_3
    ],
    search_info: {
        total: 5,
        limit: 3,
        total_on_page: 3,
        page: 1,
        pages: 2
    }
}

export const data_source_taskRequestCreationModel_1: PrivateTaskRequestCreationModel = {
    task_type_id: 1,
    task_status_id: 1,
    task_owner_id: 1,
    task_project_id: 1,

    task_log_file_path: "Path/to/log/file",
    task_params: '{ "samples": ["perle3_003"] }',
}
export const data_source_taskRequestCreationModel_2: PrivateTaskRequestCreationModel = {
    task_type_id: 1,
    task_status_id: 1,
    task_owner_id: 1,
    task_project_id: 1,

    task_log_file_path: "Path/to/log/file",
    task_params: '{ "samples": ["Mooring_0N_23W_201910_850m"] }',
}