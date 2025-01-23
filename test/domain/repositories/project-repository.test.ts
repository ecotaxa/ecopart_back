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

describe("Project Repository", () => {
    let mockProjectDataSource: ProjectDataSource;
    let projectRepository: ProjectRepository;
    let DATA_STORAGE_FS_STORAGE: "test/data_storage/";
    let DATA_STORAGE_EXPORT: "test/data_storage/files_system_storage/";
    let DATA_STORAGE_FOLDER: "test/data_storage/FTP/ecopart_exported_data/";

    beforeEach(() => {
        jest.clearAllMocks();
        mockProjectDataSource = new MockProjectDataSource()
        projectRepository = new ProjectRepositoryImpl(mockProjectDataSource, DATA_STORAGE_FS_STORAGE, DATA_STORAGE_EXPORT, DATA_STORAGE_FOLDER)
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
            expect(result).toStrictEqual(projectResponseModel)
        });
    });

})
