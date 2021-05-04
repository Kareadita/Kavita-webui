import { FilterId } from "./filter-id";

export interface FilterCriterion {
    
    key: string;
    appliesTo: Array<FilterId>;
    label: string;
}