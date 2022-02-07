import React from 'react'
import styled from 'styled-components'

import { Page, PageHeading } from '@gnomad/ui'

import DocumentTitle from '../../base/DocumentTitle'
import Link from '../../base/Link'

import Searchbox from '../shared/components/Searchbox'

const HomePageHeading = styled(PageHeading)`
  margin: 3em 0 1em;
`

const HomePageWrapper = styled(Page)`
  max-width: 740px;
  font-size: 16px;

  p {
    margin: 0 0 1.5em;
    line-height: 1.5;
  }
`

export default () => (
  <HomePageWrapper>
    <DocumentTitle title="TOB browser" />
    <HomePageHeading>Tasmanian Ophthalmic Biobank analysis</HomePageHeading>

    <Searchbox width="100%" />
    <p style={{ marginTop: '0.25em' }}>
      Or <Link to="/results">view all results</Link>
    </p>

    <h2>Examples</h2>
    <ul>
      <li>
        <Link to="/results/22:37200000-39200000">22:37200000-39200000</Link>
      </li>
      <li>
        <Link to="/results/22:37966255-37978623">22:37966255-37978623</Link>
      </li>
      <li>
        <Link to="/results/2-42752280-A-G">2-42752280-A-G</Link>
      </li>
      <li>
        <Link to="/violin/BRCA1">BRCA1 Violin Plots</Link>
      </li>
      <li>
        <Link to="/violin/IL8">IL8 Violin Plots</Link>
      </li>
    </ul>

    <h2>Project information</h2>
    <p>
      This project will involve analysis of 1,000 samples from the Tasmanian Ophthalmic Biobank.
    </p>
    <p>
      Whole-genome sequencing (WGS), genome-wide SNP array genotyping (SNPchip), and single-cell
      blood RNA sequencing (scRNA-seq (~1,000 cells/individual)) have been performed for these
      samples. Our primary focus will be the analysis of the WGS and SNPchip data.
    </p>

    <div>
      The project is a collaboration with the following groups:
      <ul>
        <li>
          <b>Menzies Institute for Medical Research, Tasmania: </b>
          Professor Alex Hewitt is one of five ophthalmic clinicians who established the biobank.
        </li>
        <li>
          <b>Garvan-Weizmann Centre for Cellular Genomics: </b>
          A/Prof Joseph Powell&apos;s group generated the scRNA-seq and SNPchip data as part of the
          OneK1K study.
        </li>
        <li>
          <b>Kinghorn Centre for Clinical Genomics: </b>
          Responsible for the generation of WGS data.
        </li>
      </ul>
    </div>

    <h2>Sample characteristics</h2>
    <ul>
      <li>Total samples: ~1,000</li>
      <li>Ancestry: almost entirely European</li>
      <li>Age: adults</li>
      <li>Phenotype: controls, no signs of ocular disease</li>
    </ul>
  </HomePageWrapper>
)
