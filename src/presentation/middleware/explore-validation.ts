import { NextFunction, Request, Response } from 'express';
import { check, validationResult } from 'express-validator';
import { BINNED_DEPTH_STEP_M, BINNED_TIME_STEP_H } from '../../domain/constants/binned-export';
import { ExploreBounds, ExploreClassificationState, ExploreFilters } from '../../domain/entities/explore';
import { ProjectPrivacyLevel } from '../../domain/entities/project';
import { EXPLORE_IMAGES_MAX } from '../../domain/use-cases/explore/explore-ecotaxa';

export interface IMiddlewareExploreValidation {
    rulesExploreRequest: any[];
    rulesExploreGraphs: any[];
    rulesExploreImages: any[];
}

const MODES = ["depth", "time", "all"];
// A curve has one axis: the graphs take one sample type.
const GRAPH_MODES = ["depth", "time"];
const PRIVACY_STATUSES: ProjectPrivacyLevel[] = ["private", "visible", "public", "open"];
const CLASSIFICATION_STATES: ExploreClassificationState[] = ["all", "fully_predicted", "fully_validated"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fail = (message: string): never => { throw new Error(message); };

function intArray(value: unknown, name: string, min = 1, max = Number.MAX_SAFE_INTEGER): number[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return fail(`${name} must be an array`);
    return value.map(item => {
        const n = Number(item);
        if (!Number.isInteger(n) || n < min || n > max) fail(`${name} must contain integers between ${min} and ${max}`);
        return n;
    });
}

function stringArray(value: unknown, name: string, allowed?: readonly string[]): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) return fail(`${name} must be an array`);
    return value.map(item => {
        if (typeof item !== "string" || item.trim() === "") fail(`${name} must contain non-empty strings`);
        if (allowed && !allowed.includes(item)) fail(`${name} must contain values among: ${allowed.join(", ")}`);
        return item;
    });
}

function range(value: unknown, name: string, min: number, max: number): [number, number] | null {
    if (value === undefined || value === null) return null;
    if (!Array.isArray(value) || value.length !== 2) return fail(`${name} must be an array of two numbers`);
    const [a, b] = value.map(Number);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a < min || b > max) fail(`${name} must hold two numbers between ${min} and ${max}`);
    return [a, b];
}

function bounds(value: unknown): ExploreBounds | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object") return fail("bounds must be an object");
    const box = value as Record<string, unknown>;
    const coordinate = (key: string, limit: number) => {
        const n = Number(box[key]);
        if (!Number.isFinite(n) || Math.abs(n) > limit) fail(`bounds.${key} must be a number between -${limit} and ${limit}`);
        return n;
    };
    const result = { north: coordinate("north", 90), south: coordinate("south", 90), east: coordinate("east", 180), west: coordinate("west", 180) };
    if (result.south > result.north) fail("bounds.south must not exceed bounds.north");
    return result;
}

function date(value: unknown, name: string): string | null {
    if (value === undefined || value === null || value === "") return null;
    // Date.parse accepts "2024-02-30" as 1 March: the parsed date must read back the same.
    if (typeof value !== "string" || !DATE.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) return fail(`${name} must be a date YYYY-MM-DD`);
    return value;
}

const bool = (value: unknown, name: string, fallback: boolean): boolean => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "boolean") return value;
    if (value === "true" || value === "false") return value === "true";
    return fail(`${name} must be a boolean`);
};

// The criteria as the front sends them; throws with the message to answer on the first bad field.
export function parseExploreFilters(value: unknown): ExploreFilters | null {
    if (value === undefined || value === null) return null;
    if (typeof value !== "object" || Array.isArray(value)) fail("filters must be an object or null");
    const f = value as Record<string, unknown>;
    const classification_state = f.classification_state ?? "all";
    if (!CLASSIFICATION_STATES.includes(classification_state as ExploreClassificationState)) fail(`classification_state must be one of: ${CLASSIFICATION_STATES.join(", ")}`);
    const filters: ExploreFilters = {
        project_ids: intArray(f.project_ids, "project_ids"),
        instrument_models: stringArray(f.instrument_models, "instrument_models"),
        bounds: bounds(f.bounds),
        date_from: date(f.date_from, "date_from"),
        date_to: date(f.date_to, "date_to"),
        months: intArray(f.months, "months", 1, 12),
        sample_names: stringArray(f.sample_names, "sample_names"),
        hour_range: range(f.hour_range, "hour_range", 0, 24),
        pressure_range: range(f.pressure_range, "pressure_range", 0, 20000),
        privacy_statuses: stringArray(f.privacy_statuses, "privacy_statuses", PRIVACY_STATUSES) as ProjectPrivacyLevel[],
        my_projects: bool(f.my_projects, "my_projects", false),
        ctd_only: bool(f.ctd_only, "ctd_only", false),
        ecotaxa_imported_only: bool(f.ecotaxa_imported_only, "ecotaxa_imported_only", false),
        ecotaxa_exclude_not_living: bool(f.ecotaxa_exclude_not_living, "ecotaxa_exclude_not_living", false),
        classification_state: classification_state as ExploreClassificationState,
    };
    if (filters.date_from && filters.date_to && filters.date_from > filters.date_to) fail("date_from must not exceed date_to");
    return filters;
}

const validate = (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(422).json({ errors: errors.array() });
    next();
};

const modeRule = (modes: string[]) =>
    check("mode").exists().withMessage("mode is required.").isIn(modes).withMessage(`mode must be one of: ${modes.join(", ")}.`);

const filtersRule = check("filters")
    .custom(value => { parseExploreFilters(value); return true; })
    .customSanitizer(value => { try { return parseExploreFilters(value); } catch { return value; } });

const requestRules = [modeRule(MODES), filtersRule];

export class MiddlewareExploreValidation implements IMiddlewareExploreValidation {
    rulesExploreRequest = [...requestRules, validate];

    rulesExploreGraphs = [
        modeRule(GRAPH_MODES),
        filtersRule,
        check("pressure_bin").optional({ nullable: true })
            .isFloat({ min: BINNED_DEPTH_STEP_M.min, max: BINNED_DEPTH_STEP_M.max }).withMessage(`pressure_bin must be a number between ${BINNED_DEPTH_STEP_M.min} and ${BINNED_DEPTH_STEP_M.max}.`).toFloat(),
        check("time_bin").optional({ nullable: true })
            .isFloat({ min: BINNED_TIME_STEP_H.min, max: BINNED_TIME_STEP_H.max }).withMessage(`time_bin must be a number between ${BINNED_TIME_STEP_H.min} and ${BINNED_TIME_STEP_H.max}.`).toFloat(),
        validate,
    ];

    rulesExploreImages = [
        ...requestRules,
        check("count").optional({ nullable: true })
            .isInt({ min: 1, max: EXPLORE_IMAGES_MAX }).withMessage(`count must be an integer between 1 and ${EXPLORE_IMAGES_MAX}.`).toInt(),
        validate,
    ];
}
