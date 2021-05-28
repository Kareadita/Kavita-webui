import { Component, Input, OnInit } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastrService } from 'ngx-toastr';
import { SelectionModel } from 'src/app/typeahead/typeahead.component';
import { CollectionTag } from 'src/app/_models/collection-tag';
import { Pagination } from 'src/app/_models/pagination';
import { Series } from 'src/app/_models/series';
import { CollectionTagService } from 'src/app/_services/collection-tag.service';
import { SeriesService } from 'src/app/_services/series.service';

@Component({
  selector: 'app-edit-collection-tags',
  templateUrl: './edit-collection-tags.component.html',
  styleUrls: ['./edit-collection-tags.component.scss']
})
export class EditCollectionTagsComponent implements OnInit {

  @Input() tag!: CollectionTag;
  series: Array<Series> = [];
  selections!: SelectionModel<Series>;
  isLoading: boolean = true;

  pagination!: Pagination;
  selectAll: boolean = true;


  constructor(public modal: NgbActiveModal, private seriesService: SeriesService, private collectionService: CollectionTagService, private toastr: ToastrService) { }

  ngOnInit(): void {
    if (this.pagination == undefined) {
      this.pagination = {totalPages: 1, totalItems: 200, itemsPerPage: 200, currentPage: 0};
    }
    this.loadSeries();
  }

  onPageChange(pageNum: number) {
    this.pagination.currentPage = pageNum;
    this.loadSeries();
  }

  toggleAll() {
    this.selectAll = !this.selectAll;
    this.series.forEach(s => this.selections.toggle(s, this.selectAll));
  }

  loadSeries() {
    this.seriesService.getSeriesForTag(this.tag.id, this.pagination.currentPage, this.pagination.itemsPerPage).subscribe(series => {
      this.pagination = series.pagination;
      this.series = series.result;
      this.selections = new SelectionModel<Series>(true, this.series);
      this.isLoading = false;
    });
  }

  handleSelection(item: Series) {
    this.selections.toggle(item);
    const numberOfSelected = this.selections.selected().length;
    if (numberOfSelected == 0) {
      this.selectAll = false;
    } else if (numberOfSelected == this.series.length) {
      this.selectAll = true;
    }
  }

  togglePromotion() {
    const originalPromotion = this.tag.promoted;
    this.tag.promoted = !this.tag.promoted;
    this.collectionService.updateTag(this.tag).subscribe(res => {
      this.toastr.success('Tag updated successfully');
    }, err => {
      this.tag.promoted = originalPromotion;
    });
  }

  reset() {

  }

  close() {
    this.modal.close({success: false, tag: undefined});
  }

  save() {
    console.log('selected: ', this.selections._data);
    //this.modal.close({success: true, tag: this.tag});
    // if (this.member?.username === undefined) {
    //   return;
    // }

    // const selectedLibraries = this.selectedLibraries.filter(item => item.selected).map(item => item.data);
    // this.libraryService.updateLibrariesForMember(this.member?.username, selectedLibraries).subscribe(() => {
    //   this.modal.close(true);
    // });
  }

  get someSelected() {
    const selected = this.selections.selected();
    return (selected.length != this.series.length && selected.length != 0);
  }

}
