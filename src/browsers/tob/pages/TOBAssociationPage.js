import React, { useState } from 'react'
import PropTypes from 'prop-types'

import { PlotWrapper } from '../utilities/styling'
import TOBAssociationHeatmap from '../shared/TOBAssociationHeatmap'

const TOBAssociationPage = ({ match }) => {
  const [search, setSearch] = useState(match.params.query || '22:37966255-37978623')

  console.log(match)

  return (
    <>
      <PlotWrapper>
        <TOBAssociationHeatmap query={search} />
      </PlotWrapper>
    </>
  )
}

TOBAssociationPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBAssociationPage
