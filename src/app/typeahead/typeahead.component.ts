import { HttpClient } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnInit, Output, Renderer2, RendererStyleFlags2, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, shareReplay, switchMap, tap } from 'rxjs/operators';
import { TypeaheadSettings } from './typeahead-settings';

export class SelectionModel<T> {
  _data!: Array<{value: T, selected: boolean}>;

  constructor(selectedState: boolean, selectedOptions: Array<T>) {
    this._data = [];

    selectedOptions.forEach(d => {
      const dataItem = this._data.filter(data => data.value == d);
      if (dataItem.length > 0) {
        dataItem[0].selected = selectedState;
      } else {
        this._data.push({value: d, selected: selectedState});
      }
    });
  }

  toggle(data: T) {
    const dataItem = this._data.filter(d => d.value == data);
    if (dataItem.length > 0) {
      dataItem[0].selected = !dataItem[0].selected;
    }
  }

  isSelected(data: T): boolean {
    const dataItem = this._data.filter(d => d.value == data);
    if (dataItem.length > 0) {
      return dataItem[0].selected;
    }
    return false;
  }

  selected(): Array<T> {
    return this._data.filter(d => d.selected).map(d => d.value);
  }
}

@Component({
  selector: 'app-typeahead',
  templateUrl: './typeahead.component.html',
  styleUrls: ['./typeahead.component.scss']
})
export class TypeaheadComponent implements OnInit {

  filteredOptions!: Observable<string[]>;
  typeaheadControl!: FormControl;
  typeaheadForm!: FormGroup;
  isLoadingOptions: boolean = false;

  @Input() settings!: TypeaheadSettings;
  @Output() selectedData = new EventEmitter<any[] | any>();
  @Output() newItemAdded = new EventEmitter<any[] | any>();

  selectedOptionIds: any[] = [];
  selectedOptions: any[] = [];

  optionSelection!: SelectionModel<any>;

  hasFocus = false; // Whether input has active focus
  @ViewChild('input') inputElem!: ElementRef<HTMLInputElement>;

  constructor(private httpClient: HttpClient, private renderer2: Renderer2) { }

  ngOnInit() {

    if (this.settings.hasOwnProperty('formControl') && this.settings.formControl) {
      this.typeaheadControl = this.settings.formControl;
    } else {
      this.typeaheadControl = new FormControl();
    }
    this.typeaheadForm = new FormGroup({
      'typeahead': this.typeaheadControl
    });


    this.optionSelection = new SelectionModel<any>(true, this.selectedOptionIds);

    if (!Array.isArray(this.settings.fetchFn)) {
      if (this.settings.compareFn !== undefined) {
        console.error('compareFn is only used when fetchFn is passed in as an array');
      }
    }

    this.filteredOptions = this.typeaheadForm.get('typeahead')!.valueChanges
      .pipe(
        debounceTime(this.settings.debounce),
        distinctUntilChanged(),
        filter(val => {
          // If minimum filter characters not met, do not filter
          if (!val || val.length < this.settings.minCharacters) {
            return false;
          }
          return true;
        }),
        switchMap(val => {
          this.isLoadingOptions = true;
          let results: Observable<any[]>;
          if (Array.isArray(this.settings.fetchFn)) {
            const filteredArray = this.settings.compareFn(this.settings.fetchFn, this.typeaheadControl.value);
            results = of(filteredArray).pipe(filter((item: any) => this.filterSelected(item)));
          } else {
            results = this.settings.fetchFn(this.typeaheadControl.value).pipe(filter((item: any) => this.filterSelected(item)));
          }

          return results;
        }), // TODO: need to make sure results don't match anything in the selected items already
        tap(() => this.isLoadingOptions = false),
        shareReplay()
      );


    if (this.settings.savedData) {
      if (this.typeaheadControl.pristine && this.settings.multiple) {
        this.settings.savedData.forEach((data: any) => this.toggleSelection(null, data));
      } else if (this.typeaheadControl.pristine && !this.settings.multiple) {
        this.typeaheadControl.setValue(this.settings.displayFn(this.settings.savedData));
        this.toggleSingle(this.settings.savedData);
      }
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyPress(event: KeyboardEvent) { 
    if (!this.hasFocus) { return; }
    // if event not control key (is visible key)
    //this.inputElem.nativeElement.style.width += 20;
    const width = parseInt(this.inputElem.nativeElement.style.width, 10) || this.inputElem.nativeElement.getBoundingClientRect().width
    console.log('width: ', width);
    this.renderer2.setStyle(this.inputElem.nativeElement, 'width', width + 20, RendererStyleFlags2.Important);
    console.log(event);
  }



  toggleSingle(opt: any): void {
    this.selectedData.emit(opt);
  }


  toggleSelection(event: any, opt: any): void {

    this.optionSelection.toggle(opt[this.settings.id]);

    if (this.selectedOptionIds.indexOf(opt[this.settings.id]) > -1) {

      this.selectedOptionIds = this.selectedOptionIds.filter(selected => selected !== opt[this.settings.id]);
      this.selectedOptions = this.selectedOptions.filter(selected => selected[this.settings.id] !== opt[this.settings.id]);
    } else {
      this.selectedOptionIds.push(opt[this.settings.id]);
      this.selectedOptions.push(opt);
    }

    this.selectedData.emit(this.selectedOptions);
    this.typeaheadControl.setValue('');
    this.shiftFocus();
  }

  removeSelectedOption(opt: any) {
    this.optionSelection.toggle(opt[this.settings.id]);

    this.selectedOptionIds = this.selectedOptionIds.filter(item => item !== opt[this.settings.id]);
    this.selectedOptions = this.selectedOptions.filter(item => item[this.settings.id] !== opt[this.settings.id]);

    this.selectedData.emit(this.selectedOptions);

  }

  addNewItem(title: string) {
    if (this.settings.addTransformFn == undefined) {
      return;
    }
    const newItem = this.settings.addTransformFn(title);
    this.newItemAdded.emit(newItem);
    this.toggleSelection(undefined, newItem);

    
    // this.typeaheadControl.setValue('');
    // this.shiftFocus();
  }

  shiftFocus() {
    if (this.inputElem) {
      this.inputElem.nativeElement.focus();
    }
  }

  filterSelected(item: any) {
    if (this.settings.unique && this.settings.multiple && this.selectedOptionIds.length > 0) {
      return this.selectedOptionIds.indexOf(item[this.settings.id]) >= 0;
    }
    return true;
  }

  setFocus() {
    this.hasFocus = true;

    if (this.settings.minCharacters === 0) {
      this.isLoadingOptions = true;
      let results: Observable<any[]>;
      if (Array.isArray(this.settings.fetchFn)) {
        const filteredArray = this.settings.compareFn(this.settings.fetchFn, '');
        results = of(filteredArray).pipe(filter((item: any) => this.filterSelected(item)));
      } else {
        results = this.settings.fetchFn('').pipe(filter((item: any) => this.filterSelected(item)));
      }


      this.filteredOptions = results;
      this.isLoadingOptions = false;
    }
  }

}
