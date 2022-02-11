import React from 'react'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom'

import ErrorBoundary from './shared/components/ErrorBoundary'
import PageNotFoundPage from './shared/components/PageNotFoundPage'

import TopBar from './components/TopBar'

import TOBHomePage from './pages/TOBHomePage'
import TOBAssociationPage from './pages/TOBAssociationPage'
import TOBGenePage from './pages/TOBGenePage'
import TOBVariantPage from './pages/TOBVariantPage'
import TOBViolinPage from './pages/TOBViolinPage'

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
        <Routes>
          <Route path="/results" element={<TOBAssociationPage />}>
            <Route path=":query" element={<TOBAssociationPage />} />
          </Route>

          <Route path="/gene/:gene" element={<TOBGenePage />} />
          <Route path="/violin/:gene" element={<TOBViolinPage />} />
          <Route path="/variant/:variant" element={<TOBVariantPage />} />

          <Route path="/" element={<TOBHomePage />} />
          <Route path="*" element={<PageNotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </div>
  </Router>
)

export default TOBBrowser
