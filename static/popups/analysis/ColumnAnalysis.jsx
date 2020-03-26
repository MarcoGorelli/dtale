import qs from "querystring";

import _ from "lodash";
import PropTypes from "prop-types";
import React from "react";
import { connect } from "react-redux";
import Select, { createFilter } from "react-select";

import { RemovableError } from "../../RemovableError";
import actions from "../../actions/dtale";
import { buildURLParams } from "../../actions/url-utils";
import chartUtils from "../../chartUtils";
import { findColType } from "../../dtale/gridUtils";
import { fetchJson } from "../../fetcher";
import { renderCodePopupAnchor } from "../CodePopup";
import { AGGREGATION_OPTS } from "../charts/Aggregations";
import { createChart, filterBuilder } from "./columnAnalysisUtils";

require("./ColumnAnalysis.css");

const BASE_ANALYSIS_URL = "/dtale/column-analysis";

class ReactColumnAnalysis extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      chart: null,
      bins: "20",
      top: "100",
      type: null,
      dtype: null,
      ordinalCol: null,
      ordinalAgg: _.find(AGGREGATION_OPTS, { value: "sum" }),
    };
    this.buildChartTypeToggle = this.buildChartTypeToggle.bind(this);
    this.buildOrdinalInputs = this.buildOrdinalInputs.bind(this);
    this.buildAnalysisFilters = this.buildAnalysisFilters.bind(this);
    this.buildAnalysis = this.buildAnalysis.bind(this);
  }

  shouldComponentUpdate(newProps, newState) {
    if (!_.isEqual(this.props, newProps)) {
      return true;
    }
    const updateState = ["bins", "top", "dtype", "type", "error", "ordinalCol", "ordinalAgg"];
    if (!_.isEqual(_.pick(this.state, updateState), _.pick(newState, updateState))) {
      return true;
    }

    if (this.state.chart != newState.chart) {
      // Don't re-render if we've only changed the chart.
      return false;
    }

    // Otherwise, use the default react behavior.
    return false;
  }

  componentDidMount() {
    this.buildAnalysis();
  }

  buildChartTypeToggle() {
    return (
      <div className="col-auto btn-group">
        {_.map(
          [
            ["Histogram", "histogram"],
            ["Value Counts", "value_counts"],
          ],
          ([label, value]) => {
            const buttonProps = { className: "btn" };
            if (value === this.state.type) {
              buttonProps.className += " btn-primary active";
            } else {
              buttonProps.className += " btn-primary inactive";
              buttonProps.onClick = () => this.setState({ type: value }, this.buildAnalysis);
            }
            return (
              <button key={value} {...buttonProps}>
                {label}
              </button>
            );
          }
        )}
      </div>
    );
  }

  buildOrdinalInputs() {
    const updateOrdinal = (prop, val) => {
      const currState = _.assignIn({}, _.pick(this.state, ["ordinalCol", "ordinalAgg"]), { [prop]: val });
      if (currState.ordinalCol && currState.ordinalAgg) {
        this.setState(currState, this.buildAnalysis);
      }
    };
    const colOpts = _.map(
      _.sortBy(
        _.reject(this.state.cols, {
          name: _.get(this.props, "chartData.selectedCol"),
        }),
        c => _.toLower(c.name)
      ),
      c => ({ value: c.name })
    );
    return [
      <div key={0} className="col-auto text-center pr-4">
        <div>
          <b>Ordinal</b>
        </div>
        <div style={{ marginTop: "-.5em" }}>
          <small>(Choose Col/Agg)</small>
        </div>
      </div>,
      <div key={1} className="col-auto pl-0 mr-3 ordinal-dd">
        <Select
          className="Select is-clearable is-searchable Select--single"
          classNamePrefix="Select"
          options={colOpts}
          getOptionLabel={_.property("value")}
          getOptionValue={_.property("value")}
          value={this.state.ordinalCol}
          onChange={v => updateOrdinal("ordinalCol", v)}
          noOptionsText={() => "No columns found"}
          isClearable
          filterOption={createFilter({ ignoreAccents: false })}
        />
      </div>,
      <div key={2} className="col-auto pl-0 mr-3 ordinal-dd">
        <Select
          className="Select is-clearable is-searchable Select--single"
          classNamePrefix="Select"
          options={AGGREGATION_OPTS}
          getOptionLabel={_.property("label")}
          getOptionValue={_.property("value")}
          value={this.state.ordinalAgg}
          onChange={v => updateOrdinal("ordinalAgg", v)}
          filterOption={createFilter({ ignoreAccents: false })}
        />
      </div>,
    ];
  }

  buildAnalysisFilters() {
    const colType = findColType(this.state.dtype);
    const title = this.state.type === "histogram" ? "Histogram" : "Value Counts";
    const filterHandler = filterBuilder(this.state, this.buildAnalysis, state => this.setState(state));
    if ("int" === colType) {
      // int -> Value Counts or Histogram
      if (this.state.type === "histogram") {
        return (
          <div className="form-group row small-gutters mb-0">
            <div className="col row">
              {this.buildChartTypeToggle()}
              {filterHandler("bins")}
            </div>
            <div className="col-auto">
              <div>{renderCodePopupAnchor(this.state.code, title)}</div>
            </div>
          </div>
        );
      } else {
        return (
          <div className="form-group row small-gutters mb-0">
            <div className="col row">
              {this.buildChartTypeToggle()}
              {filterHandler("top")}
              {this.buildOrdinalInputs()}
            </div>
            <div className="col-auto">
              <div>{renderCodePopupAnchor(this.state.code, title)}</div>
            </div>
          </div>
        );
      }
    } else if ("float" === colType) {
      // floats -> Histogram
      return (
        <div className="form-group row small-gutters mb-0">
          <div className="col row">
            <h4 className="pl-5 pt-3 modal-title font-weight-bold">{title}</h4>
            {filterHandler("bins")}
          </div>
          <div className="col-auto">
            <div>{renderCodePopupAnchor(this.state.code, title)}</div>
          </div>
        </div>
      );
    }
    // date, string, bool -> Value Counts
    return (
      <div className="form-group row small-gutters mb-0">
        <div className="col row">
          <h4 className="pl-5 pt-3 modal-title font-weight-bold">{title}</h4>
          {filterHandler("top")}
          {this.buildOrdinalInputs()}
        </div>
        <div className="col-auto">
          <div>{renderCodePopupAnchor(this.state.code, title)}</div>
        </div>
      </div>
    );
  }

  buildAnalysis() {
    const { selectedCol } = this.props.chartData;
    const paramProps = ["selectedCol", "query", "bins", "top", "type", "ordinalCol", "ordinalAgg"];
    const params = _.assignIn({}, this.props.chartData, _.pick(this.state, ["type", "bins", "top"]));
    params.ordinalCol = _.get(this.state.ordinalCol, "value");
    params.ordinalAgg = _.get(this.state.ordinalAgg, "value");
    const url = `${BASE_ANALYSIS_URL}/${this.props.dataId}?${qs.stringify(buildURLParams(params, paramProps))}`;
    fetchJson(url, fetchedChartData => {
      const newState = { error: null };
      if (_.get(fetchedChartData, "error")) {
        newState.error = <RemovableError {...fetchedChartData} />;
      }
      newState.code = _.get(fetchedChartData, "code", "");
      newState.dtype = _.get(fetchedChartData, "dtype", "");
      newState.type = _.get(fetchedChartData, "chart_type", "histogram");
      newState.query = _.get(fetchedChartData, "query");
      newState.cols = _.get(fetchedChartData, "cols", []);
      const builder = ctx => {
        if (!_.get(fetchedChartData, "data", []).length) {
          return null;
        }
        return createChart(ctx, fetchedChartData, selectedCol, newState.type);
      };
      newState.chart = chartUtils.chartWrapper("columnAnalysisChart", this.state.chart, builder);
      this.setState(newState);
    });
  }

  render() {
    if (!_.isEmpty(this.state.error)) {
      return (
        <div key="body" className="modal-body">
          {this.state.error}
        </div>
      );
    }
    let description = null;
    if (actions.isPopup()) {
      description = (
        <div key="description" className="modal-header">
          <h4 className="modal-title">
            <i className="ico-equalizer" />
            {` ${this.state.type === "histogram" ? "Histogram" : "Value Counts"} for `}
            <strong>{_.get(this.props, "chartData.selectedCol")}</strong>
            {this.state.query && <small>{this.state.query}</small>}
            <div id="describe" />
          </h4>
        </div>
      );
    }
    return [
      description,
      <div key="inputs" className="modal-body modal-form">
        {this.buildAnalysisFilters()}
      </div>,
      <div key="body" className="modal-body">
        <canvas id="columnAnalysisChart" height={this.props.height} />
      </div>,
    ];
  }
}
ReactColumnAnalysis.displayName = "ColumnAnalysis";
ReactColumnAnalysis.propTypes = {
  dataId: PropTypes.string.isRequired,
  chartData: PropTypes.shape({
    visible: PropTypes.bool.isRequired,
    selectedCol: PropTypes.string,
    query: PropTypes.string,
  }),
  height: PropTypes.number,
};
ReactColumnAnalysis.defaultProps = { height: 400 };

const ReduxColumnAnalysis = connect(state => _.pick(state, ["dataId", "chartData", "error"]))(ReactColumnAnalysis);

export { ReactColumnAnalysis, ReduxColumnAnalysis as ColumnAnalysis };
