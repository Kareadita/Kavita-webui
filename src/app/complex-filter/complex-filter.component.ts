import { Component, OnInit, SimpleChange, SimpleChanges } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { FilterService } from '../filter.service';
import { SeriesService } from '../_services/series.service';
import { WhereClause } from './_models/filter-query';

export enum WhereConditional
{
  Equals = 0,
  LessThan = 1,
  GreaterThan = 2,
  LessThanEqualTo = 3,
  GreaterThanEqualTo = 4,
  Contains = 5,
  Has = 6,
}

@Component({
  selector: 'app-complex-filter',
  templateUrl: './complex-filter.component.html',
  styleUrls: ['./complex-filter.component.scss']
})
export class ComplexFilterComponent implements OnInit {

  filterForm: FormGroup = new FormGroup({});
  primaryOptions: Array<string> = ['title', 'rating', 'review'];
  secondaryOptions: Array<{value: number, label: string}> = [
    {value: WhereConditional.Equals, label: 'Equals'},
    {value: WhereConditional.LessThan, label: 'Less Than'},
    {value: WhereConditional.GreaterThan, label: 'Greater Than'},
    {value: WhereConditional.LessThanEqualTo, label: 'Less Than Equal To'},
    {value: WhereConditional.GreaterThanEqualTo, label: 'Greater Than Equal To'},
    {value: WhereConditional.Contains, label: 'Contains'},
    {value: WhereConditional.Has, label: 'Has'},
  ]; // 'is less than', 'is less than or equal', 'is greater than', 'is greater than or equal', 'equal'
  searchQueries: FormArray = new FormArray([]);

  
  constructor(private filterSerivce: FilterService) { }

  ngOnInit(): void {
    this.filterForm.addControl('primaryOptions', new FormControl(this.primaryOptions[0], []));
    this.filterForm.addControl('secondaryOptions', new FormControl('', []));
    this.filterForm.addControl('query', new FormControl('', []));
    this.filterForm.addControl('limitTo', new FormControl(false, []));

    this.filterForm.valueChanges.subscribe((updatedModel: SimpleChanges) => {
      console.log('changes: ', updatedModel);
      this.setupSecondaryOptions();
    });

    this.addQuery();
  }

  setupSecondaryOptions() {
    const key = this.filterForm.get('primaryOptions')?.value;
    // TODO: Check if an actual change occured
    if (key == 'rating') {
      this.secondaryOptions = [
        {value: WhereConditional.Equals, label: 'Equals'},
        {value: WhereConditional.LessThan, label: 'Less Than'},
        {value: WhereConditional.GreaterThan, label: 'Greater Than'},
        {value: WhereConditional.LessThanEqualTo, label: 'Less Than Equal To'},
        {value: WhereConditional.GreaterThanEqualTo, label: 'Greater Than Equal To'},
        {value: WhereConditional.Has, label: 'Has'},
      ];
    } else if (key == 'review') {
      this.secondaryOptions = [
        {value: WhereConditional.Has, label: 'Has'},
      ];
    } else {
      this.secondaryOptions = [
        {value: WhereConditional.Equals, label: 'Equals'},
        {value: WhereConditional.LessThan, label: 'Less Than'},
        {value: WhereConditional.GreaterThan, label: 'Greater Than'},
        {value: WhereConditional.LessThanEqualTo, label: 'Less Than Equal To'},
        {value: WhereConditional.GreaterThanEqualTo, label: 'Greater Than Equal To'},
        {value: WhereConditional.Contains, label: 'Contains'},
        {value: WhereConditional.Has, label: 'Has'},
      ];
    }
    this.filterForm.get('primaryOptions')?.setValue(this.secondaryOptions[0]);
  }

  createSearchControl() {
    return new FormGroup({
      'key': new FormControl('', []),
      'condtional': new FormControl(this.secondaryOptions[0], []),
      'value': new FormControl('', [])
    });
  }

  addQuery() {
    this.searchQueries.push(this.createSearchControl());
    this.searchQueries.controls.forEach(c => {
      console.log(c);
    })
  }

  applyFilter() {
    const filter = {limit: 10, sortOrder: -1, whereClauses: [{conditional: 'EQUALS', key: 'Name', value: 'Accel World'}]}
    this.filterSerivce.getFilteredSeries(filter).subscribe(res => {
      console.log(res);
    })
  }

}
