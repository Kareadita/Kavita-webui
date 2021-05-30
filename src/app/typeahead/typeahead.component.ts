import { Component, ContentChild, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, Renderer2, RendererStyleFlags2, TemplateRef, ViewChild } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Angular } from '@sentry/integrations';
import { Observable, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, shareReplay, switchMap, take, takeUntil, tap } from 'rxjs/operators';
import { KEY_CODES } from '../shared/_services/utility.service';
import { TypeaheadSettings } from './typeahead-settings';

/**
   * SelectionModel<T> is used for keeping track of multiple selections. Simple interface with ability to toggle. 
   * @param selectedState Optional state to set selectedOptions to. If not passed, defaults to false.
   * @param selectedOptions Optional data elements to inform the SelectionModel of. If not passed, as toggle() occur, items are tracked.
   * @param propAccessor Optional string that points to a unique field within the T type. Used for quickly looking up.
   */
export class SelectionModel<T> {
  _data!: Array<{value: T, selected: boolean}>;
  _propAccessor: string = '';

  constructor(selectedState: boolean = false, selectedOptions: Array<T> = [], propAccessor: string = '') {
    this._data = [];

    if (propAccessor != undefined || propAccessor !== '') {
      this._propAccessor = propAccessor;
    }

    selectedOptions.forEach(d => {
      this._data.push({value: d, selected: selectedState});
      // why did i have those checks in the constructor?
      // const dataItem = this._data.filter(data => data.value == d);
      // if (dataItem.length > 0) {
      //   dataItem[0].selected = selectedState;
      // } else {
      //   this._data.push({value: d, selected: selectedState});
      // }
    });
  }

  // __lookupItem(item: T) {
  //   if (this._propAccessor != '') {
  //     // TODO: Implement this code to speedup lookups (use a map rather than array)
  //   }
  //   const dataItem = this._data.filter(data => data.value == d);
  // }

  /**
   * Will toggle if the data item is selected or not. If data option is not tracked, will add it and set state to true.
   * @param data Item to toggle
   */
  toggle(data: T, selectedState?: boolean) {
    const dataItem = this._data.filter(d => d.value == data);
    if (dataItem.length > 0) {
      if (selectedState != undefined) {
        dataItem[0].selected = selectedState;
      } else {
        dataItem[0].selected = !dataItem[0].selected;
      }
    } else {
      this._data.push({value: data, selected: (selectedState === undefined ? true : selectedState)});
    }
  }

  /**
   * Is the passed item selected
   * @param data item to check against
   * @returns boolean
   */
  isSelected(data: T): boolean {
    const dataItem = this._data.filter(d => d.value == data);
    if (dataItem.length > 0) {
      return dataItem[0].selected;
    }
    return false;
  }

  /**
   * 
   * @returns All Selected items
   */
  selected(): Array<T> {
    return this._data.filter(d => d.selected).map(d => d.value);
  }

  /**
   * 
   * @returns All Non-Selected items
   */
   unselected(): Array<T> {
    return this._data.filter(d => !d.selected).map(d => d.value);
  }
}

@Component({
  selector: 'app-typeahead',
  templateUrl: './typeahead.component.html',
  styleUrls: ['./typeahead.component.scss']
})
export class TypeaheadComponent implements OnInit, OnDestroy {

  filteredOptions!: Observable<string[]>;
  isLoadingOptions: boolean = false;
  typeaheadControl!: FormControl;
  typeaheadForm!: FormGroup;
  

  @Input() settings!: TypeaheadSettings;
  @Output() selectedData = new EventEmitter<any[] | any>();
  @Output() newItemAdded = new EventEmitter<any[] | any>();

  optionSelection!: SelectionModel<any>;

  hasFocus = false; // Whether input has active focus
  focusedIndex: number = 0;
  showAddItem: boolean = false;

  @ViewChild('input') inputElem!: ElementRef<HTMLInputElement>;
  @ContentChild('optionItem') optionTemplate!: TemplateRef<any>;
  
  private readonly onDestroy = new Subject<void>();

  constructor(private renderer2: Renderer2) { }

  ngOnDestroy(): void {
    this.onDestroy.next();
    this.onDestroy.complete();
  }

  ngOnInit() {

    if (this.settings.hasOwnProperty('formControl') && this.settings.formControl) {
      this.typeaheadControl = this.settings.formControl;
    } else {
      this.typeaheadControl = new FormControl('');
    }
    this.typeaheadForm = new FormGroup({
      'typeahead': this.typeaheadControl
    });


    this.optionSelection = new SelectionModel<any>(true, this.settings.savedData);

    this.filteredOptions = this.typeaheadForm.get('typeahead')!.valueChanges
      .pipe(
        debounceTime(this.settings.debounce),
        //distinctUntilChanged(),
        filter(val => {
          // If minimum filter characters not met, do not filter
          console.log('will ' + val + ' pass filter? ', !val || val.trim().length < this.settings.minCharacters);
          if (this.settings.minCharacters === 0) return true;

          if (!val || val.trim().length < this.settings.minCharacters) {
            return false;
          }
          return true;
        }),
        switchMap(val => {
          this.isLoadingOptions = true;
          let results: Observable<any[]>;
          if (Array.isArray(this.settings.fetchFn)) {
            const filteredArray = this.settings.compareFn(this.settings.fetchFn, val.trim());
            results = of(filteredArray).pipe(filter((item: any) => this.filterSelected(item)));
          } else {
            results = this.settings.fetchFn(val.trim()).pipe(filter((item: any) => this.filterSelected(item)));
          }

          return results;
        }),
        tap((val) => {
          this.isLoadingOptions = false; 
          this.focusedIndex = 0; 
          this.updateHighlight();
          this.updateShowAddItem(val);
        }),
        shareReplay(),
        takeUntil(this.onDestroy)
      );


    if (this.settings.savedData) {
      if (this.typeaheadControl.pristine && this.settings.multiple) {
        this.settings.savedData.forEach((data: any) => this.toggleSelection(data));
      } else if (this.typeaheadControl.pristine && !this.settings.multiple) {
        this.typeaheadControl.setValue(this.settings.displayFn(this.settings.savedData));
        this.toggleSingle(this.settings.savedData);
      } else {
        this.typeaheadControl.setValue('');
      }
    }
  }

  @HostListener('window:click', ['$event'])
  handleDocumentClick() {
    this.hasFocus = false;
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyPress(event: KeyboardEvent) { 
    if (!this.hasFocus) { return; }
    console.log(event);
    
    if (event.key === KEY_CODES.DOWN_ARROW) {
      this.focusedIndex = Math.min(this.focusedIndex + 1, document.querySelectorAll('.list-group-item').length - 1);
      this.updateHighlight();
    } else if (event.key === KEY_CODES.UP_ARROW) {
      this.focusedIndex = Math.max(this.focusedIndex - 1, 0);
      this.updateHighlight();
    } else if (event.key === KEY_CODES.ENTER) {
      document.querySelectorAll('.list-group-item').forEach((item, index) => {
        if (item.classList.contains('active')) {
          this.filteredOptions.pipe(take(1)).subscribe((res: any) => {
            var result = res.filter((item: any, index: number) => index === this.focusedIndex);
            if (result.length === 1) {
              if (item.classList.contains('add-item')) {
                this.addNewItem(this.typeaheadControl.value)
              } else {
                this.toggleSelection(result[0]);
              }
            }
          });
        }
      });
    }
    else {
      // Adjust input box to grow
       // if event not control key (is visible key)
      //this.inputElem.nativeElement.style.width += 20;
      const width = parseInt(this.inputElem.nativeElement.style.width, 10) || this.inputElem.nativeElement.getBoundingClientRect().width
      console.log('width: ', width);
      this.renderer2.setStyle(this.inputElem.nativeElement, 'width', width + 20, RendererStyleFlags2.Important);
    
    }


  }

  toggleSingle(opt: any): void {
    this.optionSelection.toggle(opt);
    this.selectedData.emit(opt);
  }


  toggleSelection(opt: any): void {
    this.optionSelection.toggle(opt);
    this.selectedData.emit(this.optionSelection.selected());
    this.resetField();
  }

  

  removeSelectedOption(opt: any) {
    this.optionSelection.toggle(opt);
    this.selectedData.emit(this.optionSelection.selected());
    this.resetField();
  }

  addNewItem(title: string) {
    if (this.settings.addTransformFn == undefined) {
      return;
    }
    const newItem = this.settings.addTransformFn(title);
    this.newItemAdded.emit(newItem);
    this.toggleSelection(newItem);

    this.resetField();
  }

  filterSelected(item: any) {
    const selected = this.optionSelection.selected();
    
    if (this.settings.unique && this.settings.multiple && selected.length > 0) {
      return !this.optionSelection.isSelected(item);
    }


    return true;
  }

  onInputFocus(event: any) {
    event.stopPropagation();
    event.preventDefault();

    if (this.hasFocus) { return; }

    if (this.inputElem) {
      this.inputElem.nativeElement.focus();
      this.hasFocus = true;
    }
   
    this.typeaheadControl.patchValue(this.typeaheadControl.value.trim() + ' ');
  }


  resetField() {
    this.renderer2.setStyle(this.inputElem.nativeElement, 'width', 4, RendererStyleFlags2.Important);
    this.typeaheadControl.setValue('');
  }

  // Updates the highlight to focus on the selected item
  updateHighlight() {
    document.querySelectorAll('.list-group-item').forEach((item, index) => {
      if (index === this.focusedIndex) {
        // apply active class
        this.renderer2.addClass(item, 'active');
      } else {
        // remove active class
        this.renderer2.removeClass(item, 'active');
      }
    });
  }

  updateShowAddItem(options: any[]) {
    this.showAddItem = this.settings.addIfNonExisting && this.typeaheadControl.value.trim() 
          && this.typeaheadControl.value.trim().length >= Math.max(this.settings.minCharacters, 1) 
          && this.typeaheadControl.dirty
          && (typeof this.settings.compareFn == 'function' && this.settings.compareFn(options, this.typeaheadControl.value.trim()).length === 0);
  }

}
