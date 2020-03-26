import _ from "lodash";
import $ from "jquery";
import chartUtils from "../../chartUtils";
import { findColType } from "../../dtale/gridUtils";
import React from "react";

const DESC_PROPS = ["count", "mean", "std", "min", "25%", "50%", "75%", "max"];

function createChart(ctx, fetchedData, col, type) {
  const { desc, labels, data } = fetchedData;
  if (desc) {
    const descHTML = _.map(DESC_PROPS, p => `${_.capitalize(p)}: <b>${desc[p]}</b>`).join(", ");
    $("#describe").html(`<small>${descHTML}</small>`);
  } else {
    $("#describe").empty();
  }
  const chartCfg = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{ label: col, data: data, backgroundColor: "rgb(42, 145, 209)" }],
    },
    options: {
      legend: { display: false },
      scales: {
        xAxes: [
          {
            scaleLabel: {
              display: true,
              labelString: type === "histogram" ? "Bin" : "Value",
            },
          },
        ],
        yAxes: [
          {
            scaleLabel: {
              display: true,
              labelString: "Count",
            },
          },
        ],
      },
    },
  };
  if (type === "value_counts") {
    chartCfg.options.scales.yAxes[0].ticks = { min: 0 };
  }
  return chartUtils.createChart(ctx, chartCfg);
}

function filterBuilder(state, chartBuilder, propagateState) {
  return prop => {
    const colType = findColType(state.dtype);
    const updateFilter = e => {
      if (e.key === "Enter") {
        if (state[prop] && parseInt(state[prop])) {
          chartBuilder();
        }
        e.preventDefault();
      }
    };
    return [
      <div key={0} className={`col-auto text-center pr-4 ${colType === "int" ? "pl-0" : ""}`}>
        <div>
          <b>{_.capitalize(prop)}</b>
        </div>
        <div style={{ marginTop: "-.5em" }}>
          <small>(Please edit)</small>
        </div>
      </div>,
      <div key={1} style={{ width: "3em" }} data-tip="Press ENTER to submit" className="mb-auto mt-auto">
        <input
          type="text"
          className="form-control text-center column-analysis-filter"
          value={state[prop]}
          onChange={e => propagateState({ [prop]: e.target.value })}
          onKeyPress={updateFilter}
        />
      </div>,
    ];
  };
}

export { createChart, filterBuilder };
