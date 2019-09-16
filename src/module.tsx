import React, { PureComponent } from 'react';
import { PanelProps, PanelPlugin, PanelEditorProps, PanelOptionsGroup, FormField } from '@grafana/ui';

import ReactTable from 'react-table';
import { CSVLink } from "react-csv";
import numeral from 'numeral';
import Rainbow from 'rainbowvis.js';
import percentile from 'percentile';








interface MyPanelOptions {

    format: any;
    pivotBy: any;
    showN: boolean;
    showTotal: boolean;
    colWidth: any;
}

const defaultOptions = {
  format: {
    default: {
      font_size: 12,
      numeral_format: '0.00a',
      coloring: 'yes',
      color_by: 'value', //'value', 'rank', 'threshold'
      thresholds: [],
      gradient_colors: ['#52545C', '#A352CC' ]
    }
  },
  pivotBy: {},
  showN: true,
  showTotal: true,
  colWidth: {}
};

const pivotData = function(data, pivotOptions) {
  const row_col = pivotOptions['row'];
  const col_col = pivotOptions['col'];
  const val_col = pivotOptions['val'];
  const agg = pivotOptions['agg'];
  let col_col_no = -1;
  let row_col_no = -1;
  let val_col_no = -1;
  for (const j in data.fields) {
    col_col_no = data.fields[j]['name'] === col_col ? Number(j) : col_col_no;
    row_col_no = data.fields[j]['name'] === row_col ? Number(j) : row_col_no;
    val_col_no = data.fields[j]['name'] === val_col ? Number(j) : val_col_no;
  }
  const col_cols: any = [];
  const row_cols: any = [];
    data.rows.forEach(function(r) {

      if (!col_cols.includes(r[col_col_no])) {
        col_cols.push(r[col_col_no]);
      }
      if (!row_cols.includes(r[row_col_no])) {
        row_cols.push(r[row_col_no]);

      }
    });
  const rows: any = [];
  row_cols.forEach(function(r) {
    const row: any = [r];
    col_cols.forEach(function(c) {
      const arr: any = [];
      data.rows.forEach(function(dr) {

        if (dr[row_col_no] === r && dr[col_col_no] === c) {
          arr.push(dr[val_col_no]);
        }
      });
        if (agg === 'sum') {
          row.push(arr.length>0 ? arr.reduce((x, y) => x + y) : null);
        } else if (agg === 'avg') {
          row.push(arr.length>0 ? arr.reduce((x, y) => x + y)/arr.length : null);
        } else if (agg === 'max') {
          row.push(arr.length>0 ? Math.max.apply(null, arr) : null);
        } else if (agg === 'min') {
          row.push(arr.length>0 ? Math.min.apply(null, arr) : null);
        } else {
          row.push(null);
        }

      });
      rows.push(row);
    });

  const fields: any = [{type: 'string', 'name': row_col}];
  col_cols.forEach(function(c) {
    fields.push({type: 'string', 'name': c});
  });
  return {fields: fields, rows: rows};
};

//import 'react-table/react-table.css';


const transformData = function(data: any, props) {

  function pad (str, max, symbol) {
    str = str.toString();
    return str.length < max ? pad(symbol + str, max, symbol) : str;
  }



  function pad_float(str, max) {
    if (!isNaN(Number(str)) && Number(str) != 0) {
      const arr = str.split('.');
      if (arr.length<2) {
        arr.push(0);
      }
      if (Number(str) > 0) {
        return pad(arr[0],max, '0') + '.' + arr[1];
      } else {
        let str_ = '';
        for (let i = 0; i<str.length; i++) {
          str_ += str[i] === '.' ? '.' : '9876543210'.charAt(Number(str.charAt(i)));
        }
        const arr_ = str_.split('.');
        return '-' + pad(arr_[0].substring(1),max, 'z') + '.' + arr_[1];
      }
    } else {
      return str;
    }
  }

  console.log(data);
  const res: any = [];
  const res_raw: any = [];

  const series: any = {};

  for (const i in data.rows) {
    const res_ = {};
    if (props.options.showN) {
      res_['N'] = 'N&' + pad((Number(i)+1).toString(),Math.floor(Math.log10(data.rows.length))+1,0);
    }
    const res_raw_ = {};

    for (const j in data.fields) {
      res_[data.fields[j]['name']]  = (data.fields[j]['name'] === null ? '' : data.fields[j]['name']) + ('&') + (data.rows[i][j] === null ? '' : pad_float(data.rows[i][j].toString(), 12));
      res_raw_[data.fields[j]['name']] = data.rows[i][j];


      if  (!(data.fields[j]['name'] in series) ) {
        series[data.fields[j]['name']] = [];
        series[data.fields[j]['name']].push(data.rows[i][j]);
      } else {
        series[data.fields[j]['name']].push(data.rows[i][j]);
      }
    }
    res.push(res_);
    res_raw.push(res_raw_);
  }
  const total: any = props.options.showN ? {'N': 'N&∑'} : {};
  const max_len: any = {};

    for (const s in series) {

      const sum = series[s].reduce((x, y) => x + y);
      total[s] = ( s + '&' + (isNaN(Number(sum)) ? 'Total' : sum));
      max_len[s] = Math.max.apply(null, series[s].map(function(x) {return x ? x.toString().length : 0;}));

    }

  console.log('max_len', max_len);
  if (props.options.showTotal) {
    res.push(total);
  }

  const color_series = function(s, how, gradient_colors, thresholds = []) {


    if (how === 'rank') {
      const sorted = s.slice().sort(function(a,b) {return b-a;});
      const ranks = s.slice().map(function(v) { return s.length - (sorted.indexOf(v)); });
    } else if (how === 'value') {


      const max = !isNaN(Math.max.apply(null, s)) ? Math.max.apply(null,s) : 1;
      const min = !isNaN(Math.min.apply(null, s)) ? Math.min.apply(null,s) : 0;

      const ranks = s.slice().map(function(v) {return !isNaN(Number(v)) && max != min ? Math.round((Number(v)-min) / (max-min) * 100) : -1;});
      ranks[0] = ranks[0] === -1 ? 0 : ranks[0];

    } else if (how === 'logvalue') {
      const s_ = s.slice().map(function(x) {return x/Math.abs(x) * Math.log(1+Math.abs(x));});


      const max = !isNaN(Math.max.apply(null, s_)) ? Math.max.apply(null,s_) : 1;
      const min = !isNaN(Math.min.apply(null, s_)) ? Math.min.apply(null,s_) : 0;

      const ranks = s_.slice().map(function(v) {return !isNaN(Number(v)) && max != min ? Math.round((Number(v)-min) / (max-min) * 100) : -1;});
      ranks[0] = ranks[0] === -1 ? 0 : ranks[0];

    }

    const s_coloured = {};

    const color_by_threshold = function (v, colors, thresholds) {
      for (let i = 0; i<thresholds.length; i++) {
        if (v < thresholds[i]) {
          return colors[i];
        }
      }
      return colors[colors.length - 1];
    };


    if (how === 'threshold') {


      for (let i = 0; i<s.length; i++) {
        s_coloured[s[i]] = color_by_threshold(s[i], gradient_colors, thresholds);
      }
    } else if (how === 'threshold_pct') {
      const thresholds_ = thresholds.slice().map(function(x) {return percentile(x, s);});
      for (let i = 0; i<s.length; i++) {
        s_coloured[s[i]] = color_by_threshold(s[i], gradient_colors, thresholds_);
      }
    } else {

      const r: any = new Rainbow();
      r.setSpectrum.apply(null,gradient_colors);
      let min = Math.min.apply(null, ranks);
      const max = Math.max.apply(null,ranks);
      if (min==max) {
        min -= 1;
      }
      r.setNumberRange(min,max);

      for (let i = 0; i<s.length; i++) {
        s_coloured[s[i]] = '#' + r.colourAt(ranks[i]);
      }

  }
  return s_coloured;
  };

  const series_coloured = {};
  for (const k in series) {
    if (k in props.options.format) {
      const thresholds = 'thresholds' in props.options.format[k] ? props.options.format[k].thresholds : [];
      const s_ = color_series(series[k], props.options.format[k].color_by, props.options.format[k].gradient_colors, thresholds);
    } else {
      const s_ = color_series(series[k], props.options.format.default.color_by, props.options.format.default.gradient_colors, props.options.format.default.thresholds);
    }
    for (const m in s_) {
      series_coloured[k.toString()+'&' + pad_float(m.toString(),12)] = s_[m];
    }
  }







const myNumber = function(n) {
  if (n[0] === '-') {
    const n_ = n.replace(/z/g, '');
    let nn = '-';
    for (let i = 0; i < n_.length -1; i++) {
      nn += n_.charAt(i+1) === '.' ? '.' : '9876543210'.charAt(Number(n_.charAt(i+1)));
    }
    return Number(nn);
  } else {
    return Number(n);
  }
};
const col_max_length = {};
let col_length_sum = 0;
let num_length_sum = 0;
let str_length_sum = 0;
for (const q in total) {
  if (q === 'N') {

    col_max_length[q] = {
      len: data.rows.length.toString().length + 1,
      type: 'num'
    };
    num_length_sum += col_max_length[q].len;

  } else {
  if (!isNaN(myNumber(total[q].split('&')[1]))) {
    col_max_length[q] = {
      len: q in props.options.format
              ? props.options.format[q].numeral_format.length +2
              : props.options.format.default.numeral_format.length +2,
      type: 'num'
    },
    num_length_sum += col_max_length[q].len;

  } else {
    col_max_length[q] = {
      len: max_len[q] > 10 ? 10 : max_len[q],
      type: 'str'
    };
    str_length_sum += col_max_length[q].len;  }
}
col_length_sum += col_max_length[q].len;
}

let pix_for_num = num_length_sum / col_length_sum * props.width;


if (pix_for_num < num_length_sum * 12 ) {
  pix_for_num = num_length_sum * 12;
}

if (pix_for_num > num_length_sum * 17 ) {
  pix_for_num = num_length_sum * 17;
}
let pix_for_str = props.width-20 - pix_for_num;

if (pix_for_str < str_length_sum*12) {
  pix_for_str = str_length_sum*12;
}



const col_width = {};
for (const q in col_max_length) {
  if (col_max_length[q].type === 'num') {
    col_width[q] = pix_for_num * col_max_length[q].len / num_length_sum;
  } else {
    col_width[q] = pix_for_str * col_max_length[q].len / (str_length_sum);
  }
}

console.log(pix_for_str, pix_for_num, col_length_sum, num_length_sum, col_width);

const columns: any = [];
  if (props.options.showN) {
  columns.push({
    Header: 'N',
    accessor: 'N',
    width: col_width['N'] ,
    Cell: row => (<div style = {{textAlign: "left"}}>{row.value.split('&')[1]}</div>)
  });
}

console.log(col_max_length, col_length_sum);
console.log(props);

  for (const j in data.fields) {


      columns.push({
        Header: x =>  <div style={{
          textAlign: "center"
      }}>{x.column.id} </div>,
        accessor: data.fields[j]['name'],
        //numeral(row.value).format('0.00a')
        /*width : data.fields[j]['name'] in props.options.format
                    ? props.options.format[data.fields[j]['name']].column_width
                    : props.options.format.default.column_width,*/
        width: /*data.fields[j]['name'] in props.options.colWidth ? props.options.colWidth[data.fields[j]['name']]*props.width :*/ col_width[data.fields[j]['name']],
        textAlign: "center",


        Cell: row => (<div style={{
          height: "15px",
          textAlign: !isNaN(myNumber(row.value.split('&')[1])) &&  row.value.split('&')[1] != '' ? "center": "left",
          fontSize: props.options.format.default.font_size,

          color: !isNaN(myNumber(row.value.split('&')[1])) && ((row.value.split('&')[0] in props.options.format
                              ? props.options.format[row.value.split('&')[0]].coloring
                              :  props.options.format.default.coloring) === 'yes')
                                  ? series_coloured[row.value]
                                  : null
            }}
          >
          {!isNaN(myNumber(row.value.split('&')[1])) &&  row.value.split('&')[1] != ''
              ? numeral(myNumber(row.value.split('&')[1])).format(row.value.split('&')[0] in props.options.format
                  ? props.options.format[row.value.split('&')[0]].numeral_format
                  : props.options.format.default.numeral_format)
              : row.value.split('&')[1]}

          </div>)
      });
  }

  return {columns: columns, data: res, data_raw: res_raw, series: series, series_coloured: series_coloured};
};

export class MyPanel extends PureComponent<PanelProps<MyPanelOptions>> {

  onWidthChanged = (newResized, event) => {
    const colWidth_ = this.props.options.colWidth;
    for (const w in newResized) {
      colWidth_[newResized[w].id] = newResized[w].value/this.props.width;
    }
    this.props.onOptionsChange({
      ...this.props.options,
      colWidth: colWidth_
    });
    // console.log(this.props.options.chart_type);
  };

  render() {





    const transformedData = transformData(JSON.stringify(this.props.options.pivotBy) === '{}' ? this.props.data.series[0] : pivotData(this.props.data.series[0], this.props.options.pivotBy), this.props);

    console.log(transformedData);

    console.log(this.props);
    //ggg

    const n: number = transformedData.data.length;

    return <div>
      <CSVLink data={transformedData.data_raw}>Download CSV</CSVLink>
      <ReactTable
        data={transformedData.data}
        columns = {transformedData.columns}
        pageSize={n>Math.floor((this.props.height - 20) / 34) ? Math.floor((this.props.height - 90) / 34)  : Math.floor((this.props.height - 90) / 34)+2}
        showPageSizeOptions={false}
        showPagination={n>Math.floor((this.props.height - 20) / 34)}
        onResizedChange={this.onWidthChanged}
      />
      </div>;
  }
}

export class MyPanelEditor extends PureComponent<PanelEditorProps<MyPanelOptions>> {




  onFormatChanged = (evt: any) => {
    this.props.onOptionsChange({
      ...this.props.options,
      format: JSON.parse(evt.target.value)
    });

  };

  onPivotByChanged = (evt: any) => {
    this.props.onOptionsChange({
      ...this.props.options,
      pivotBy: JSON.parse(evt.target.value)
    });
    // console.log(this.props.options.chart_type);
  };

  onShowNChanged = (evt: any) => {
    this.props.onOptionsChange({
      ...this.props.options,
      showN: evt.target.value.toString() === 'true'
    });
    // console.log(this.props.options.chart_type);
  };

  onShowTotalChanged = (evt: any) => {
    this.props.onOptionsChange({
      ...this.props.options,
      showTotal: evt.target.value.toString() === 'true'
    });
    // console.log(this.props.options.chart_type);
  };

  render() {
    return (
      <PanelOptionsGroup title="My panel options">

        <FormField
          label='Format'
          labelWidth={50}
          onBlur={this.onFormatChanged}
          defaultValue={this.props.options.format}
          inputEl={
            React.createElement('textarea',
                                          {
                                            rows: 20,
                                            cols: 50,
                                            defaultValue: JSON.stringify(this.props.options.format, null, 2),
                                            onBlur: this.onFormatChanged
                                          }
                                        )

          }
          />

        <FormField
          label="Pivot Options"
          labelWidth = {50}
          onBlur={this.onPivotByChanged}
          defaultValue={JSON.stringify(this.props.options.pivotBy)}
          inputWidth={30}
           />

          <FormField
          label="Show N"
          labelWidth = {50}
          onBlur={this.onShowNChanged}
          defaultValue={this.props.options.showN.toString()}
          inputWidth={10}
           />
           <FormField
          label="Show Total"
          labelWidth = {50}
          onBlur={this.onShowTotalChanged}
          defaultValue={this.props.options.showTotal.toString()}
          inputWidth={10}
           />

      </PanelOptionsGroup>
    );
}
}

export const plugin = new PanelPlugin(MyPanel);
plugin.setDefaults({

  format: defaultOptions.format,
  pivotBy: defaultOptions.pivotBy,
  showN: defaultOptions.showN,
  showTotal: defaultOptions.showTotal,
  colWidth: defaultOptions.colWidth
});
plugin.setEditor(MyPanelEditor);
