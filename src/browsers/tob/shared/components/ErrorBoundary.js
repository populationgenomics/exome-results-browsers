/* eslint-disable no-console */

import React from 'react'
import PropTypes from 'prop-types'

import { ExternalLink, Link as StyledLink, Page, PageHeading } from '@gnomad/ui'

import DocumentTitle from './DocumentTitle'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch = (error, info) => {
    console.group('Error information')
    console.error(error)
    console.error(info)
    console.groupEnd()
  }

  render() {
    const { children } = this.props
    const { hasError } = this.state

    if (hasError) {
      const repo = 'https://github.com/populationgenomics/exome-results-browsers'
      const issueURL = `${repo}/issues/new?title=${encodeURIComponent(
        `Render error on ${window.location.href}`
      )}`

      return (
        <Page>
          <DocumentTitle title="Error" />
          <PageHeading>Something Went Wrong</PageHeading>
          <p>An error occurred while rendering this page.</p>
          <p>
            This is a bug. Please{' '}
            <ExternalLink href={issueURL}>file an issue on GitHub</ExternalLink> and{' '}
            <StyledLink href="/">reload the browser</StyledLink>.
          </p>
        </Page>
      )
    }

    return children
  }
}

ErrorBoundary.propTypes = {
  children: PropTypes.node.isRequired,
}

export default ErrorBoundary
