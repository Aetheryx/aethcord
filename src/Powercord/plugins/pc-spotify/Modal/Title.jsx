const { React } = require('powercord/webpack');

module.exports = class Title extends React.Component {
  constructor (props) {
    super(props);

    this.canvas = document.createElement('canvas').getContext('2d');
    this.state = {
      hovered: false
    };
  }

  render () {
    const titleElement = document.querySelector(`.${this.props.className.replace(/ /g, '.')}`);
    this.canvas.font = titleElement ? getComputedStyle(titleElement).font : null;
    const titleWidth = Math.ceil(this.canvas.measureText(this.props.children).width);
    const animationDuration = (titleWidth - 78) * 90;
    let { className } = this.props;
    if (this.state.hovered) {
      className += ' translating';
    }

    return (
      <span
        onMouseEnter={() => this.setState({ hovered: titleWidth > 78 })}
        onMouseLeave={() => this.setState({ hovered: false })}
        className={className}
        style={{
          animationDuration: `${animationDuration}ms`,
          width: this.state.hovered ? titleWidth : 78,
          maxWidth: this.state.hovered ? titleWidth : 78
        }}
      >{this.props.children}</span>
    );
  }
};
