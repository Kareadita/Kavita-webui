import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';

@Component({
  selector: 'app-complex-filter',
  templateUrl: './complex-filter.component.html',
  styleUrls: ['./complex-filter.component.scss']
})
export class ComplexFilterComponent implements OnInit {

  filterForm: FormGroup = new FormGroup({});
  primaryOptions: Array<string> = ['title', 'rating', 'review', ];
  secondaryOptions: Array<string> = ['is less than', 'is less than or equal', 'is greater than', 'is greater than or equal', 'equal'];

  
  constructor() { }

  ngOnInit(): void {
    this.filterForm.addControl('primaryOptions', new FormControl(this.primaryOptions[0], []));
    this.filterForm.addControl('secondaryOptions', new FormControl('', []));
    this.filterForm.addControl('query', new FormControl('', []));
    this.filterForm.addControl('limitTo', new FormControl(false, []));
  }

  applyFilter() {
    
  }

}
