import React from 'react'

import SwaggerUI from 'swagger-ui-react'
import 'swagger-ui-react/swagger-ui.css'

const TOBApiDoc = (props) => <SwaggerUI url="/api/specification" {...props} />

export default TOBApiDoc
