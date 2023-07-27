export interface SQLiteDatabaseWrapper {

    //run(sql: string, params: any, callback?: (err: Error | null) => void): void;
    run(sql: string, params: any, callback?: (this: any, err: Error | null) => void): this;
    //run(sql: string, ...params: any[]): this;

    get(sql: string, params: any, callback?: (this: any, err: Error | null, row: any) => void): void;
    //get<T>(sql: string, params: any, callback?: (this: Statement, err: Error | null, row: T) => void): this;
    //get(sql: string, ...params: any[]): this;

    all(sql: string, callback?: (this: any, err: Error | null, rows: any[]) => void): void;
    //all<T>(sql: string, params: any, callback?: (this: Statement, err: Error | null, rows: T[]) => void): this;
    //all(sql: string, ...params: any[]): this;

}

