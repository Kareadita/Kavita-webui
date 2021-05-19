import { Person } from "./person";

export interface SeriesMetadata {
    publisher: string;
    genres: Array<string>;
    tags: Array<string>;
    persons: Array<Person>;
    seriesId: number;
}