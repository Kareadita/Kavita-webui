import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-style-control',
  templateUrl: './style-control.component.html',
  styleUrls: ['./style-control.component.scss']
})
export class StyleControlComponent implements OnInit, OnChanges {

  @Input() label: string = '';
  @Input() value!: any;
  @Input() valueModifier: string = ''; // Modifier is like px, %, etc. Used externally to this component, but useful for showing. Default to ''.
  @Input() type: 'number' | 'string' = 'number'; 
  @Output() valueChange = new EventEmitter<number>();

  valueLabel: string = '';

  constructor() { }

  ngOnInit(): void {
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.value) {
      this.valueLabel = this.value + this.valueModifier;
    }
  }
}
