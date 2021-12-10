import React, { useState } from 'react'
import PropTypes from 'prop-types'

import TOBAssociationHeatmap from '../shared/TOBAssociationHeatmap'

const TOBAssociationPage = ({ match }) => {
  const [search, setSearch] = useState(match.params.query || '22:37966255-37978623')

  return (
    <>
      <TOBAssociationHeatmap query={search} />
    </>
  )
}

TOBAssociationPage.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  match: PropTypes.object.isRequired,
}

export default TOBAssociationPage
