# Exome Results Browsers

Results browsers for case-control studies of psychiatric diseases done at the Broad Institute.

- [Schizophrenia - SCHEMA](https://schema.broadinstitute.org)

  The Schizophrenia Exome Sequencing Meta-analysis (SCHEMA) consortium is a large multi-site
  collaboration dedicated to aggregating, generating, and analyzing high-throughput sequencing
  data of schizophrenia patients to improve our understanding of disease architecture and
  advance gene discovery. The first results of this study have provided genome-wide significant
  results associating rare variants in individual genes to risk of schizophrenia, and later
  releases are planned with larger number of samples that will further increase power.

- [Epilepsy - Epi25](https://epi25.broadinstitute.org)

  The Epi25 collaborative is a global collaboration committed to aggregating, sequencing,
  and deep-phenotyping up to 25,000 epilepsy patients to advance epilepsy genetics research.
  The Epi25 whole-exome sequencing (WES) case-control study is one of the collaborative's
  ongoing endeavors that aims to characterize the contribution of rare genetic variation to
  a spectrum of epilepsy syndromes to identify individual risk genes.

- [Autism - ASC](https://asc.broadinstitute.org)

  Founded in 2010, the Autism Sequencing Consortium (ASC) is an international group
  of scientists who share autism spectrum disorder (ASD) samples and genetic data.
  This portal displays variant and gene-level data from the most recent ASC exome
  sequencing analysis.

- [Bipolar Disorder - BipEx](https://bipex.broadinstitute.org)

  The Bipolar Exome (BipEx) sequencing project is a collaboration between multiple institutions
  across the globe, which aims to increase our understanding of the disease architecture of
  bipolar disorder.

# TOB Development

Set these env variables in your shell profile:

```
# Enables the SwaggerUI interface, defaults to false.
ENABLE_SWAGGER_UI=true

# Reference genome, defaults to grch38 if blank.
REFERENCE_GENOME=grch38

# BigQuery dataset id, defaults to grch38 if blank.
DATASET_ID=test1

# Google service account to use during development with bigquery access
GOOGLE_APPLICATION_CREDENTIALS=<path to your service account>

# Set node env to development
NODE_ENV=development
```

Example to run the new API for development:

```
ENABLE_SWAGGER_UI=true REFERENCE_GENOME=grch38 DATASET_ID=test1 yarn start TOB
```

If deploying a new branch which uses a new dataset or reference, make sure to edit and update the `DATASET_ID` and `REFERENCE_GENOME` workflow secrets on github. See `.github/workflows/gcp-deploy.yml` for other env variables that you can modify.
