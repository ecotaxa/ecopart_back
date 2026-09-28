//test/domain/repositories/project-repository.test.ts
import { ProjectDataSource } from "../../../src/data/interfaces/data-sources/project-data-source";
import { ProjectRequestCreationModel, ProjectRequestModel, ProjectResponseModel, ProjectUpdateModel } from "../../../src/domain/entities/project";
import { SearchResult } from "../../../src/domain/entities/search";
import { ProjectRepository } from "../../../src/domain/interfaces/repositories/project-repository";
import { ProjectRepositoryImpl } from "../../../src/domain/repositories/project-repository";
import { instrument_model_response } from "../../entities/instrumentModel";
import { publicPrivileges_WithMemberAndManager } from "../../entities/privilege";
import { privateProjectUpdateModel, projectRequestCreationModel, projectRequestCreationModelForRepository, projectResponseModel, projectResponseModelArray, projectUpdateModel_withBadData } from "../../entities/project";
import { MockProjectDataSource } from "../../mocks/project-mock";

import 'dotenv/config'
import fs from "fs";
import fsPromisesModule from "fs/promises";
import os from "os";
import path from "path";

describe("Project Repository", () => {
    let mockProjectDataSource: ProjectDataSource;
    let projectRepository: ProjectRepository;
    let DATA_STORAGE_FS_STORAGE: string;
    let DATA_STORAGE_EXPORT: string;
    let DATA_STORAGE_FOLDER: string;

    beforeEach(() => {
        jest.clearAllMocks();
        mockProjectDataSource = new MockProjectDataSource()
        DATA_STORAGE_FS_STORAGE = "test/data_storage/";
        DATA_STORAGE_EXPORT = "test/data_storage/files_system_storage/";
        DATA_STORAGE_FOLDER = "test/data_storage/FTP/ecopart_exported_data/";
        const DATA_STORAGE_IMPORT = "test/data_storage/ecopart_data_to_import/";
        projectRepository = new ProjectRepositoryImpl(mockProjectDataSource, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, DATA_STORAGE_FOLDER, DATA_STORAGE_IMPORT)
    })


    describe("CreateProject", () => {
        test("Should create a project", async () => {
            const project: ProjectRequestCreationModel = projectRequestCreationModelForRepository

            jest.spyOn(mockProjectDataSource, 'create').mockResolvedValue(1)

            const result = await projectRepository.createProject(project)

            expect(mockProjectDataSource.create).toBeCalledWith(project)
            expect(result).toBe(1)
        })
    })

    describe("GetProject", () => {
        test("Should get a project", async () => {
            const project: ProjectRequestModel = { project_id: 1 }
            const projectResponse: ProjectResponseModel = projectResponseModel

            jest.spyOn(mockProjectDataSource, 'getOne').mockResolvedValue(projectResponse)

            const result = await projectRepository.getProject(project)

            expect(mockProjectDataSource.getOne).toBeCalledWith(project)
            expect(result).toBe(projectResponse)
        })

    })

    describe("ComputeDefaultDepthOffset", () => {
        test("Should compute default depth offset", async () => {
            const instrument_model = "UVP5HD"
            const result = projectRepository.computeDefaultDepthOffset(instrument_model)

            expect(result).toBe(1.2)
        })

        test("Should throw an error if instrument is undefined", async () => {
            const instrument_model = undefined as any
            expect(() => projectRepository.computeDefaultDepthOffset(instrument_model)).toThrowError("Instrument is required")
        })

        test("Should return undefined if instrument is not uvp5", async () => {
            const instrument_model = "not_uvp5"
            const result = projectRepository.computeDefaultDepthOffset(instrument_model)

            expect(result).toBe(undefined)
        })
    })

    describe("DeleteProject", () => {
        test("Should delete a project", async () => {
            const project: ProjectRequestModel = { project_id: 1 }

            jest.spyOn(mockProjectDataSource, 'deleteOne').mockResolvedValue(1)

            const result = await projectRepository.deleteProject(project)

            expect(mockProjectDataSource.deleteOne).toBeCalledWith(project)
            expect(result).toBe(1)
        })
    });

    describe("UpdateProject", () => {
        //TODO
        test("Should update a project", async () => {
            const project: ProjectUpdateModel = privateProjectUpdateModel

            jest.spyOn(mockProjectDataSource, 'updateOne').mockResolvedValue(1)

            const result = await projectRepository.standardUpdateProject(project)

            expect(mockProjectDataSource.updateOne).toBeCalledWith(project)
            expect(result).toBe(1)
        })

        test("Should throw an error if unauthorized params are found", async () => {
            const project = projectUpdateModel_withBadData

            jest.spyOn(mockProjectDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

            try {
                await projectRepository.standardUpdateProject(project)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : unauthorized_param")
            }
            // exceptget all have been called with
            expect(mockProjectDataSource.updateOne).not.toBeCalled()

        })

        test("Should throw an error if no valid parameter is provided", async () => {
            const project = { project_id: 1 }

            jest.spyOn(mockProjectDataSource, "updateOne").mockImplementation(() => Promise.resolve(1))

            try {
                await projectRepository.standardUpdateProject(project as ProjectUpdateModel)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Please provide at least one valid parameter to update")
            }
            // exceptget all have been called with
            expect(mockProjectDataSource.updateOne).not.toBeCalled()
        })

    });
    describe("GetProjects", () => {
        test("Should get all projects", async () => {
            const options = { page: 1, limit: 10, sort_by: [], filter: [] }
            const result: SearchResult<ProjectResponseModel> = {
                items: projectResponseModelArray,
                total: 2
            }

            jest.spyOn(mockProjectDataSource, 'getAll').mockResolvedValue(result)

            const response = await projectRepository.standardGetProjects(options)

            expect(mockProjectDataSource.getAll).toBeCalledWith(options)
            expect(response).toBe(result)
        })
        test("Should get all projects with sort_by and filter", async () => {
            const result: SearchResult<ProjectResponseModel> = {
                items: projectResponseModelArray,
                total: 2
            }
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "project_title", order_by: "asc" }],
                filter: [{ field: "project_id", operator: "IN", value: "[1,2]" }]
            }
            jest.spyOn(mockProjectDataSource, 'getAll').mockResolvedValue(result)

            const response = await projectRepository.standardGetProjects(options)

            expect(mockProjectDataSource.getAll).toBeCalledWith(options)
            expect(response).toBe(result)
        })
        test("Should return error for unauthorized sort_by", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "unauthorized_param", order_by: "asc" }],
                filter: [{ field: "project_id", operator: "IN", value: "[1,2]" }]
            }
            jest.spyOn(mockProjectDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await projectRepository.standardGetProjects(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized sort_by: unauthorized_param")
            }
            expect(mockProjectDataSource.getAll).not.toBeCalled()
        })
        test("Should return error for unauthorized order_by", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "project_title", order_by: "unauthorized_param" }],
                filter: [{ field: "project_id", operator: "IN", value: "[1,2]" }]
            }
            jest.spyOn(mockProjectDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await projectRepository.standardGetProjects(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Unauthorized order_by: unauthorized_param")
            }
            expect(mockProjectDataSource.getAll).not.toBeCalled()
        })
        test("Should return error for unauthorized filter field", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "project_title", order_by: "asc" }],
                filter: [{ field: "unauthorized_param", operator: "IN", value: "[1,2]" }]
            }
            jest.spyOn(mockProjectDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await projectRepository.standardGetProjects(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Filter field: unauthorized_param")
            }
            expect(mockProjectDataSource.getAll).not.toBeCalled()
        })
        test("Should return error for unauthorized filter operator", async () => {
            const options = {
                page: 1,
                limit: 10,
                sort_by: [{ sort_by: "project_title", order_by: "asc" }],
                filter: [{ field: "project_id", operator: "unauthorized_param", value: "[1,2]" }]
            }
            jest.spyOn(mockProjectDataSource, 'getAll').mockResolvedValue({ items: [], total: 0 })

            try {
                await projectRepository.standardGetProjects(options)
            } catch (e) {
                expect(e).toBeInstanceOf(Error)
                expect(e.message).toBe("Unauthorized or unexisting parameters : Filter operator: unauthorized_param")
            }
            expect(mockProjectDataSource.getAll).not.toBeCalled()
        })

    })

    describe("formatProjectRequestCreationModel", () => {
        test("Should format project request creation model", () => {
            const result = projectRepository.formatProjectRequestCreationModel(projectRequestCreationModel, instrument_model_response)
            expect(result).toStrictEqual(projectRequestCreationModelForRepository)
        });
    });
    describe("toPublicProject", () => {
        test("Should return public project", () => {
            const result = projectRepository.toPublicProject(projectResponseModel, publicPrivileges_WithMemberAndManager)
            const { new_ecotaxa_project, ecotaxa_account_id, ...expectedResult } = projectResponseModel as any
            expect(result).toStrictEqual(expectedResult)
        });
    });

    describe("copy_metadata", () => {
        let repository: ProjectRepositoryImpl;
        let tmp_dir: string;
        const source_folder = "source";
        const dest_folder = path.join("fs_storage", "1", "l0b_backup");

        const writeTree = (root: string, files: Record<string, string>) => {
            for (const [file, content] of Object.entries(files)) {
                fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
                fs.writeFileSync(path.join(root, file), content);
            }
        };
        const readTree = (root: string): Record<string, string> => {
            const files: Record<string, string> = {};
            for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
                const entry_path = path.join(root, entry.name);
                if (entry.isDirectory()) {
                    for (const [file, content] of Object.entries(readTree(entry_path))) files[path.join(entry.name, file)] = content;
                } else {
                    files[entry.name] = fs.readFileSync(entry_path, "utf8");
                }
            }
            return files;
        };
        const sourcePath = (...parts: string[]) => path.join(tmp_dir, source_folder, ...parts);
        const backupPath = (...parts: string[]) => path.join(tmp_dir, dest_folder, ...parts);
        const historyPath = (...parts: string[]) => path.join(tmp_dir, "fs_storage", "1", "l0b_backup_history", ...parts);
        const historyRuns = () => fs.existsSync(historyPath()) ? fs.readdirSync(historyPath()) : [];

        beforeEach(() => {
            repository = new ProjectRepositoryImpl(mockProjectDataSource, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, DATA_STORAGE_FOLDER, "");
            tmp_dir = fs.mkdtempSync(path.join(os.tmpdir(), "ecopart-copy-metadata-"));
            writeTree(sourcePath(), {
                "meta/uvp5_header_sn203.txt": "header v2",
                "config/cruise_info.txt": "cruise",
                "config/uvp5_settings/uvp5_configuration_data.txt": "settings",
            });
        });
        afterEach(() => {
            jest.restoreAllMocks();
            fs.rmSync(tmp_dir, { recursive: true, force: true });
        });

        test("Should copy meta and config on first backup without creating history", async () => {
            await repository.copy_metadata(tmp_dir, source_folder, dest_folder);

            expect(readTree(backupPath("meta"))).toStrictEqual(readTree(sourcePath("meta")));
            expect(readTree(backupPath("config"))).toStrictEqual(readTree(sourcePath("config")));
            expect(historyRuns()).toStrictEqual([]);
        });

        test("Should keep the replaced meta in history when its content changed", async () => {
            writeTree(backupPath(), {
                "meta/uvp5_header_sn203.txt": "header v1",
                "meta/removed_from_source.txt": "old file",
                "config/cruise_info.txt": "cruise",
                "config/uvp5_settings/uvp5_configuration_data.txt": "settings",
            });

            await repository.copy_metadata(tmp_dir, source_folder, dest_folder);

            expect(readTree(backupPath("meta"))).toStrictEqual({ "uvp5_header_sn203.txt": "header v2" });
            const runs = historyRuns();
            expect(runs).toHaveLength(1);
            expect(runs[0]).toMatch(/^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}$/);
            expect(readTree(historyPath(runs[0]))).toStrictEqual({
                [path.join("meta", "uvp5_header_sn203.txt")]: "header v1",
                [path.join("meta", "removed_from_source.txt")]: "old file",
            });
        });

        test("Should not create a history entry when meta and config are unchanged", async () => {
            await repository.copy_metadata(tmp_dir, source_folder, dest_folder);
            await repository.copy_metadata(tmp_dir, source_folder, dest_folder);

            expect(historyRuns()).toStrictEqual([]);
            expect(readTree(backupPath("meta"))).toStrictEqual(readTree(sourcePath("meta")));
        });

        test("Should leave the current meta untouched when the copy fails midway", async () => {
            writeTree(backupPath(), { "meta/uvp5_header_sn203.txt": "header v1" });
            const real_mkdir = fsPromisesModule.mkdir;
            const real_writeFile = fsPromisesModule.writeFile;
            jest.spyOn(fsPromisesModule, "cp").mockImplementationOnce(async (_source, destination) => {
                await real_mkdir(destination as string, { recursive: true });
                await real_writeFile(path.join(destination as string, "partial.txt"), "partial");
                throw new Error("ENOSPC: no space left on device");
            });

            await expect(repository.copy_metadata(tmp_dir, source_folder, dest_folder)).rejects.toThrow("ENOSPC: no space left on device");

            expect(readTree(backupPath())).toStrictEqual({ [path.join("meta", "uvp5_header_sn203.txt")]: "header v1" });
            expect(historyRuns()).toStrictEqual([]);
        });

        test("Should recover from the leftovers of an interrupted backup", async () => {
            writeTree(backupPath(), {
                "meta.staging/partial.txt": "partial",
                "old_meta/uvp5_header_sn203.txt": "header v1",
            });

            await repository.copy_metadata(tmp_dir, source_folder, dest_folder);

            expect(fs.readdirSync(backupPath()).sort()).toStrictEqual(["config", "meta"]);
            expect(readTree(backupPath("meta"))).toStrictEqual(readTree(sourcePath("meta")));
            const runs = historyRuns();
            expect(runs).toHaveLength(1);
            expect(readTree(historyPath(runs[0]))).toStrictEqual({ [path.join("old_meta", "uvp5_header_sn203.txt")]: "header v1" });
        });

        test("Should suffix the history folder when one already exists for the same date", async () => {
            fs.mkdirSync(historyPath("2026_09_24_10_00_00"), { recursive: true });

            const result = await repository.firstFreePath(historyPath("2026_09_24_10_00_00"));

            expect(result).toBe(historyPath("2026_09_24_10_00_00_1"));
        });
    });

})
