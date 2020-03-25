import _ from "lodash";
import PropTypes from "prop-types";
import React from "react";

function validateRandomCfg(cfg) {
  const { type } = cfg;
  if (_.includes(["int", "float"], type)) {
    let { low, high } = cfg;
    low = parseInt(low);
    high = parseInt(high);
    if (!_.isNaN(low) && !_.isNaN(high) && low > high) {
      return "Invalid range specification, low must be less than high!";
    }
  }
  return null;
}

function buildCode(cfg) {
  let code = "";
  if (cfg.type === "string") {
    code = "pd.Series([''.join(random.choice(chars) for _ in range(length)) for _ in range(len(df)]), index=df.index)";
  } else {
    let { low, high } = cfg;
    low = parseInt(low);
    high = parseInt(high);
    if (!_.isNaN(low) && !_.isNaN(high) && low > high) {
      return null;
    }
    if (cfg.type === "int") {
      code = `pd.Series(np.random.randint(${low || 0}, high=${high || 100}, size=len(df)), index=df.index)`;
    } else {
      let floats = "np.random.rand(len(df))";
      if (low < 0 || high > 1) {
        const ints = `np.random.randint(${low || 0}, high=${(high || 1) - 1}, size=len(df))`;
        floats += " " + ints;
      }
      code = `pd.Series(${floats}, index=df.index)`;
    }
  }
  return code;
}

class CreateRandom extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      type: "float",
      low: null,
      high: null,
      length: null,
      chars: null,
    };
    this.updateState = this.updateState.bind(this);
    this.renderNumericInputs = this.renderNumericInputs.bind(this);
    this.renderStringInputs = this.renderStringInputs.bind(this);
  }

  updateState(state) {
    const currState = _.assignIn(this.state, state);
    const props = currState.type === "string" ? ["type", "chars", "length"] : ["type", "low", "high"];
    let cfg = _.pick(currState, props);
    cfg = _.pickBy(cfg, _.identity);
    this.setState(currState, () => this.props.updateState({ cfg, code: buildCode(currState) }));
  }

  renderNumericInputs() {
    return [
      <div key={1} className="form-group row">
        <label className="col-md-3 col-form-label text-right">Low</label>
        <div className="col-md-8">
          <input
            type="number"
            className="form-control"
            value={this.state.low || ""}
            onChange={e => this.updateState({ low: e.target.value })}
          />
          <small>Default: 0</small>
        </div>
      </div>,
      <div key={2} className="form-group row">
        <label className="col-md-3 col-form-label text-right">High</label>
        <div className="col-md-8">
          <input
            type="number"
            className="form-control"
            value={this.state.high || ""}
            onChange={e => this.updateState({ high: e.target.value })}
          />
          <small>{`Default: ${this.state.type === "float" ? "1" : "100"}`}</small>
        </div>
      </div>,
    ];
  }

  renderStringInputs() {
    return [
      <div key={1} className="form-group row">
        <label className="col-md-3 col-form-label text-right">Length</label>
        <div className="col-md-8">
          <input
            type="number"
            className="form-control"
            value={this.state.length || ""}
            onChange={e => this.updateState({ length: e.target.value })}
          />
          <small>Default: 10</small>
        </div>
      </div>,
      <div key={2} className="form-group row">
        <label className="col-md-3 col-form-label text-right">Chars</label>
        <div className="col-md-8">
          <input
            type="text"
            className="form-control"
            value={this.state.chars || ""}
            onChange={e => this.updateState({ chars: e.target.value })}
          />
          <small>{"Default: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'"}</small>
        </div>
      </div>,
    ];
  }

  render() {
    return _.concat(
      [
        <div key={0} className="form-group row">
          <label className="col-md-3 col-form-label text-right">Data Type</label>
          <div className="col-md-8">
            <div className="btn-group">
              {_.map(["float", "int", "string"], randType => {
                const buttonProps = { className: "btn btn-primary" };
                if (randType === this.state.type) {
                  buttonProps.className += " active";
                } else {
                  buttonProps.className += " inactive";
                  buttonProps.onClick = () => this.updateState({ type: randType });
                }
                return (
                  <button key={randType} {...buttonProps}>
                    {_.capitalize(randType)}
                  </button>
                );
              })}
            </div>
          </div>
        </div>,
      ],
      this.state.type === "string" ? this.renderStringInputs() : this.renderNumericInputs()
    );
  }
}
CreateRandom.displayName = "CreateRandom";
CreateRandom.propTypes = {
  updateState: PropTypes.func,
  columns: PropTypes.array,
};

export { CreateRandom, validateRandomCfg, buildCode };
