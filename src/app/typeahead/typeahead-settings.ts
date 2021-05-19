import { Observable } from 'rxjs';
import { FormControl } from '@angular/forms';

export class TypeaheadSettings {
    debounce: number = 200;
    multiple: boolean = false;
    id: string = '';
    savedData: any[] | any;
    compareFn!:  ((optionList: any[], filter: string)  => any[]);// = undefined; 
    fetchFn!: ((filter: string) => Observable<any[]>) | any[] ; // | []
    displayFn!: ( (data: any) => string);
    minCharacters: number = 1;
    formControl?: FormControl;

}