import PropTypes from 'prop-types'
import React, { Component } from 'react'
import ReactDOM from 'react-dom'
import { Manager, Popper, Reference } from 'react-popper'

import { Arrow, Container, TooltipContainer, CloseButton } from './tooltipStyles'

export class TooltipAnchor extends Component {
  constructor(props) {
    super(props)
    this.state = { isVisible: false, isPinned: false }
    this.containerElement = document.createElement('div')
  }

  componentDidMount() {
    document.body.appendChild(this.containerElement)
  }

  componentWillUnmount() {
    document.body.removeChild(this.containerElement)
  }

  showTooltip = () => {
    this.setState((state) => ({ ...state, isVisible: true }))
  }

  hideTooltip = () => {
    this.setState((state) => ({ ...state, isVisible: false }))
  }

  togglePinned = () => {
    // eslint-disable-next-line react/destructuring-assignment
    this.setState((state) => ({ ...state, isPinned: !state.isPinned }))
  }

  unpin = () => {
    this.setState((state) => ({ ...state, isPinned: false }))
  }

  render() {
    const {
      children,
      // https://reactjs.org/docs/jsx-in-depth.html#user-defined-components-must-be-capitalized
      tooltipComponent: TooltipComponent,
      ...otherProps
    } = this.props
    const { isVisible, isPinned } = this.state

    return (
      <Manager>
        <Reference>
          {({ ref }) =>
            React.cloneElement(React.Children.only(children), {
              onMouseEnter: this.showTooltip,
              onMouseLeave: this.hideTooltip,
              onClick: this.togglePinned,
              ref,
            })
          }
        </Reference>
        {(isVisible || isPinned) &&
          ReactDOM.createPortal(
            <Popper placement="top">
              {({ ref, style, placement, arrowProps }) => (
                <Container data-placement={placement} ref={ref} style={style}>
                  <TooltipContainer>
                    <TooltipComponent {...otherProps} />
                    {isPinned ? (
                      <CloseButton onClick={this.unpin} type="button" title="Hide tooltip">
                        &#x2715;
                      </CloseButton>
                    ) : null}
                  </TooltipContainer>
                  <Arrow data-placement={placement} ref={arrowProps.ref} style={arrowProps.style} />
                </Container>
              )}
            </Popper>,
            this.containerElement
          )}
      </Manager>
    )
  }
}

TooltipAnchor.propTypes = {
  children: PropTypes.node.isRequired,
  tooltipComponent: PropTypes.func,
}

TooltipAnchor.defaultProps = {
  tooltipComponent: null,
}

export default TooltipAnchor
