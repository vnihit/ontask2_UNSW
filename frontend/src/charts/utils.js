export const filterData = (dataView, type, colNameSelected, filterCols, range) => {
  if(type==="number"){
    dataView.transform({
      type: 'filter',
      callback(row) {
        return row[colNameSelected] !=='' && row[colNameSelected] >= range[0] && row[colNameSelected] <= range[1] ;
    }});
  }
  else if(filterCols.length!==0){
    dataView.transform({
      type: 'filter',
      callback(row) {
        return row[colNameSelected] !=='' && filterCols.indexOf(row[colNameSelected]) !== -1;
    }});
  }
}

export const isInt = (n) => {
  return n % 1 === 0;
};

export const sortByColName = (dataView, type, colNameSelected) => {
  if(type === "number"){
    dataView.transform({
      type: 'sort',
      callback(a, b) {
        return a[colNameSelected][0] - b[colNameSelected][0];
      }
    })
  }
  else{
    dataView.rows.sort((a, b)=>{
      if(a[colNameSelected] > b[colNameSelected]){
        return 1;
      }
      else if(a[colNameSelected] === b[colNameSelected]){
        return 0;
      }
      else{
        return -1;
      }
    });
  }
};

export const generateCountPercentField = (dataView, type, interval, colNameSelected) => {
  let totalCount=dataView.rows.length;
  if (type === "number") {
    dataView.transform({
      type: 'bin.histogram',
      field: colNameSelected,
      binWidth: interval,
      as: [colNameSelected, 'count']
    })
    .transform({
      type: 'map',
      callback(row){
        row['percent']=(row['count']/totalCount);
        return row;
      }
    });
  }
  else{
    dataView.transform({
      type: 'aggregate', fields: [colNameSelected], 
      operations: 'count', as: 'count',
      groupBy: [colNameSelected]
    })
    .transform({
      type: 'percent', field: 'count',
      dimension: colNameSelected, as: 'percent'
    })
    .transform({
      type: 'map',
      callback(row){
        // row['percent']=row['percent'];
        return row;
      }
    });
  }
}

export const generateBoxPlot = (dataView, colNameSelected) => {
  dataView.transform({
    type: 'map',
    callback: (obj) => {
      obj[colNameSelected] = Number(obj[colNameSelected]);
      return obj;
  }})
  .transform({
    type: 'bin.quantile',
    field: colNameSelected,
    as: 'range',
    fraction: 4
  })
  .transform({
    type: 'map',
    callback: (row) => {
      row.low = row.range[0]; row.q1 = row.range[1];
      row.median = row.range[2]; row.q3 = row.range[3];
      row.high = row.range[4]; row.na = colNameSelected;
      return row;
  }});
}

export const generatePieChartLabel = (dataView, type, colNameSelected) => {
  if(type === "number"){
    dataView.transform({
      type: 'map',
      callback: (row) => {
        row[colNameSelected]=
          (isInt(row[colNameSelected][0])?row[colNameSelected][0]:row[colNameSelected][0].toFixed(1))
          +'-'+
          (isInt(row[colNameSelected][1])?row[colNameSelected][1]:row[colNameSelected][1].toFixed(1));
        return row;
    }});
  }
}

export const filterSelectedItem = (i, dataView, type, range, keys, colNameSelected, groupByCol, filterCols) => {
  if(type === "number"){
    dataView.transform({
      type: 'filter',
      callback(row) {
        if('_'+row[groupByCol] === keys[i] && row[groupByCol] !=='' && row[colNameSelected] !=='' &&
           row[colNameSelected] >= range[0] && row[colNameSelected] <= range[1]){
          return row;
        } ;
    }});
  }
  else{
    if(filterCols.length!==0){
      dataView.transform({
        type: 'filter',
        callback(row) {
          if('_'+row[groupByCol] === keys[i] && row[colNameSelected] !=='' &&
            filterCols.indexOf(row[colNameSelected]) !== -1){
            return row;
          } ;
      }});
    }
    else{
      dataView.transform({
        type: 'filter',
        callback(row) {
          if('_'+row[groupByCol] === keys[i] && row[colNameSelected] !==''){
            return row;
          } ;
      }});
    }
  }
}

export const findMaxCountPercent = (dataView) => {
  let maxCount=0;
  let maxPercent=0;

  for(let row of dataView.rows){
    if(row['count']>maxCount){
      maxCount=row['count'];
      maxPercent=row['percent'];
    }
  }

  return [maxCount, maxPercent]
}