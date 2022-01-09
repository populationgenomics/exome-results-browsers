import React from 'react'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import ErrorBoundary from '../base/ErrorBoundary'
import PageNotFoundPage from '../base/PageNotFoundPage'

import TopBar from './TopBar'

import TOBHomePage from './pages/TOBHomePage'
import TOBAssociationPage from './pages/TOBAssociationPage'
import TOBGenePage from './pages/TOBGenePage'
import TOBVariantPage from './pages/TOBVariantPage'

const TOBBrowser = () => (
  <Router>
    <TopBar title="TOB-WGS Project" backgroundColor="#000000" />

    {window.gtag && (
      <Route
        path="/"
        render={({ location }) => {
          window.gtag('config', window.gaTrackingId, {
            anonymize_ip: true,
            page_path: location.pathname,
          })
          return null
        }}
      />
    )}

    <div style={{ margin: '0 1em' }}>
      <ErrorBoundary>
        <Switch>
          <Route path="/" exact component={TOBHomePage} />

          <Route path="/results/:query?" component={TOBAssociationPage} />

          <Route path="/gene/:geneId" render={({ match }) => <TOBGenePage gene={match.gene} />} />

          <Route
            path="/variant/:variantId"
            render={({ match }) => <TOBVariantPage variant={match.variant} />}
          />

          <Route component={PageNotFoundPage} />
        </Switch>
      </ErrorBoundary>
    </div>
  </Router>
)

export default TOBBrowser
