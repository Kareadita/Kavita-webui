import { FilterCriterion } from "./filter-criterion";

export enum QueryConjunction {
    AND = 'And',
    OR = 'Or'
}

export interface OptionsSearchEval {
    criteria: string;
    visibleCriteria: string;
    sortOrder: number;
    defaultChoice: 0 | 1;
    type: number; // Make enum
    id: number; // from DB
}

export interface OptionsSearchCriteria {
    criteria: string;
    visibleCriteria: string;
    secondaryCriteria: string[];
    defaultSort: 0 | 1;
    dataType: number; // 0 is string, 2 is date
    format: FormatType;
    id: number;
}

export enum FormatType {
    Date,
    Number,
    String, 
    Dropdown
}

export interface SearchOptionsResponse {
    optionsSearchCriteriaResponses: OptionsSearchCriteria[];
    optionsSearchEval: OptionsSearchEval[];
}

export interface WhereClause {
    conditional: string;
    key: string;
    value: string;
}



export interface FilterQuery {

    // keyCriterion: FilterCriterion;
    // comparisonCriterion: FilterCriterion;
    // value: string | number;

    //queryCriteria: OptionsSearchCriteria;
    //optionsSearchEval: OptionsSearchEval;
    //query: string | Date;
    //queryConjuction: QueryConjunction;
    whereClauses: Array<WhereClause>;
    sortKey?: string;
    sortOrder: number; // todo: enum -1 | 0 | 1
    limit: number;
}